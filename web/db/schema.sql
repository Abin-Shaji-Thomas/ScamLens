-- ScamLens reports + link graph. Runs unchanged on Supabase Postgres and on PGlite (local/tests).
-- No raw chats are stored: identifiers are kept only as peppered HMAC hashes plus a masked display string.

create table if not exists reports (
  id bigint generated always as identity primary key,
  identifier_type text not null check (identifier_type in ('evm','tron','btc','upi','phone','telegram','email','domain')),
  identifier_hash text not null,
  identifier_display text not null,
  reporter_fingerprint_hash text not null,
  category text not null,
  submission_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  contested boolean not null default false,
  synthetic boolean not null default false,
  unique (identifier_hash, reporter_fingerprint_hash) -- one fingerprint counts once per identifier
);
create index if not exists reports_fp_created on reports (reporter_fingerprint_hash, created_at);

-- Edges: 'co_reported' (undirected, two identifiers named in one report) and 'payment' (directed, on-chain).
create table if not exists graph_edges (
  id bigint generated always as identity primary key,
  src_hash text not null, src_type text not null, src_display text not null,
  dst_hash text not null, dst_type text not null, dst_display text not null,
  relation text not null check (relation in ('co_reported','payment')),
  evidence text not null,
  submission_id uuid,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists graph_edges_src on graph_edges (src_hash);
create index if not exists graph_edges_dst on graph_edges (dst_hash);

create table if not exists flagged_addresses (
  address_hash text primary key, display text not null, source text not null, synthetic boolean not null default false
);
create table if not exists exchange_addresses (
  address_hash text primary key, label text not null, synthetic boolean not null default false
);

-- Seeding helpers (service role only). Payment edges come from on-chain data; flagged/exchange lists from sync jobs.
create or replace function add_payment_edge(p_src text, p_src_display text, p_dst text, p_dst_display text, p_evidence text, p_synthetic boolean)
returns table (id bigint) language sql as $$
  insert into graph_edges (src_hash, src_type, src_display, dst_hash, dst_type, dst_display, relation, evidence, synthetic)
  values (p_src, 'evm', p_src_display, p_dst, 'evm', p_dst_display, 'payment', p_evidence, p_synthetic) returning id
$$;
create or replace function add_flagged(p_hash text, p_display text, p_source text, p_synthetic boolean)
returns table (address_hash text) language sql as $$
  insert into flagged_addresses values (p_hash, p_display, p_source, p_synthetic)
  on conflict (address_hash) do update set source = excluded.source returning address_hash
$$;
create or replace function add_exchange(p_hash text, p_label text, p_synthetic boolean)
returns table (address_hash text) language sql as $$
  insert into exchange_addresses values (p_hash, p_label, p_synthetic)
  on conflict (address_hash) do update set label = excluded.label returning address_hash
$$;

create or replace view active_edges as
  select * from graph_edges where expires_at > now();

-- Store one report (several identifiers from one chat). Rate-limited per fingerprint.
create or replace function submit_report(
  p_items jsonb, p_fingerprint text, p_category text, p_submission uuid,
  p_synthetic boolean default false, p_max_per_day int default 5
) returns table (ok boolean, reason text, stored int)
language plpgsql as $$
declare
  recent int;
  n int := 0;
  a jsonb;
  b jsonb;
begin
  select count(distinct r.submission_id) into recent from reports r
    where r.reporter_fingerprint_hash = p_fingerprint and r.created_at > now() - interval '1 day';
  if recent >= p_max_per_day then
    return query select false, 'rate_limited'::text, 0;
    return;
  end if;
  for a in select * from jsonb_array_elements(p_items) loop
    insert into reports (identifier_type, identifier_hash, identifier_display, reporter_fingerprint_hash, category, submission_id, synthetic)
    values (a->>'type', a->>'hash', a->>'display', p_fingerprint, p_category, p_submission, p_synthetic)
    on conflict (identifier_hash, reporter_fingerprint_hash) do update
      set created_at = now(), expires_at = now() + interval '90 days', category = excluded.category, submission_id = excluded.submission_id;
    n := n + 1;
  end loop;
  for a in select * from jsonb_array_elements(p_items) loop
    for b in select * from jsonb_array_elements(p_items) loop
      if (a->>'hash') < (b->>'hash') then
        insert into graph_edges (src_hash, src_type, src_display, dst_hash, dst_type, dst_display, relation, evidence, submission_id, synthetic)
        values (a->>'hash', a->>'type', a->>'display', b->>'hash', b->>'type', b->>'display', 'co_reported',
                'Named together in one ' || p_category || ' report on ' || to_char(now(), 'YYYY-MM-DD'), p_submission, p_synthetic);
      end if;
    end loop;
  end loop;
  return query select true, null::text, n;
end $$;

-- Public "Reported" tier: only identifiers with >= 2 distinct fingerprints in 90 days, not contested, not expired.
create or replace function reported_counts(p_hashes text[])
returns table (identifier_hash text, identifier_type text, identifier_display text, reporters int,
               categories text[], first_reported timestamptz, last_reported timestamptz, synthetic boolean)
language sql stable as $$
  select r.identifier_hash, min(r.identifier_type), min(r.identifier_display),
         count(distinct r.reporter_fingerprint_hash)::int, array_agg(distinct r.category order by r.category),
         min(r.created_at), max(r.created_at), bool_or(r.synthetic)
  from reports r
  where r.identifier_hash = any(p_hashes)
    and r.expires_at > now() and r.created_at > now() - interval '90 days'
    and not exists (select 1 from reports c where c.identifier_hash = r.identifier_hash and c.contested)
  group by r.identifier_hash
  having count(distinct r.reporter_fingerprint_hash) >= 2
$$;

-- Contested entries are hidden from public badges until reviewed.
create or replace function contest_identifier(p_hash text)
returns table (updated int) language sql as $$
  with u as (update reports set contested = true where identifier_hash = p_hash returning 1)
  select count(*)::int from u
$$;

-- Hub filter: nodes with more than p_max distinct counterparties, or known exchange addresses.
create or replace function hub_nodes(p_max int)
returns table (hash text) language sql stable as $$
  select n from (
    select src_hash as n, dst_hash as m from active_edges
    union select dst_hash, src_hash from active_edges
  ) x group by n having count(distinct m) > p_max
  union select address_hash from exchange_addresses
$$;

-- Undirected co-report edges, both directions.
create or replace view co_edges as
  select src_hash a, src_type a_type, src_display a_display, dst_hash b, dst_type b_type, dst_display b_display, evidence, submission_id
  from active_edges where relation = 'co_reported'
  union all
  select dst_hash, dst_type, dst_display, src_hash, src_type, src_display, evidence, submission_id
  from active_edges where relation = 'co_reported';

-- Q1: UPI -> wallet -> Telegram, where UPI and Telegram are linked only through a shared wallet.
create or replace function q1_upi_wallet_telegram(p_upi text, p_hub_max int)
returns table (upi text, wallet text, wallet_hash text, telegram text, telegram_hash text, evidence_1 text, evidence_2 text)
language sql stable as $$
  select distinct uw.a_display, uw.b_display, uw.b, wt.b_display, wt.b, uw.evidence, wt.evidence
  from co_edges uw
  join co_edges wt on wt.a = uw.b
  where uw.a = p_upi and uw.a_type = 'upi'
    and uw.b_type in ('evm','tron','btc') and wt.b_type = 'telegram'
    and uw.submission_id is distinct from wt.submission_id
    and uw.b not in (select hash from hub_nodes(p_hub_max))
    and not exists (select 1 from co_edges d where d.a = uw.a and d.b = wt.b)
  order by 4
$$;

-- Q2: wallet -> up to 2 payment hops -> flagged address. Intermediates may not be hubs.
create or replace function q2_payment_to_flagged(p_wallet text, p_hub_max int)
returns table (hops int, path text[], path_display text[], flagged_source text, evidence text[])
language sql stable as $$
  with recursive hubs as (select hash from hub_nodes(p_hub_max)),
  walk(node, hops, path, path_display, evidence) as (
    select p_wallet, 0, array[p_wallet],
           array[coalesce((select src_display from active_edges where src_hash = p_wallet limit 1), p_wallet)],
           array[]::text[]
    union all
    select e.dst_hash, w.hops + 1, w.path || e.dst_hash, w.path_display || e.dst_display, w.evidence || e.evidence
    from walk w join active_edges e on e.src_hash = w.node and e.relation = 'payment'
    where w.hops < 2 and not (e.dst_hash = any(w.path))
      and (w.hops = 0 or w.node not in (select hash from hubs))
  )
  select w.hops, w.path, w.path_display, f.source, w.evidence
  from walk w join flagged_addresses f on f.address_hash = w.node
  where w.hops between 1 and 2
  order by w.hops, w.path_display
$$;

-- Q3: different Telegram handles co-reported with the same wallet, with cluster size.
create or replace function q3_telegram_clusters(p_min_size int, p_hub_max int)
returns table (wallet text, wallet_hash text, cluster_size int, handles text[], reports int)
language sql stable as $$
  select e.a_display, e.a, count(distinct e.b)::int, array_agg(distinct e.b_display order by e.b_display),
         count(distinct e.submission_id)::int
  from co_edges e
  where e.a_type in ('evm','tron','btc') and e.b_type = 'telegram'
    and e.a not in (select address_hash from exchange_addresses)
  group by e.a, e.a_display
  having count(distinct e.b) >= p_min_size and count(distinct e.b) <= p_hub_max
  order by 3 desc, 1
$$;

-- Q4: neighbourhood (up to p_depth hops, both relations) for the graph view; does not expand through hubs.
create or replace function q4_neighbourhood(p_hash text, p_depth int, p_hub_max int)
returns table (src text, src_type text, src_display text, dst text, dst_type text, dst_display text, relation text, evidence text)
language sql stable as $$
  with recursive hubs as (select hash from hub_nodes(p_hub_max)),
  und as (
    select src_hash a, dst_hash b, id from active_edges
    union all select dst_hash, src_hash, id from active_edges
  ),
  reach(node, depth) as (
    select p_hash, 0
    union
    select u.b, r.depth + 1 from reach r join und u on u.a = r.node
    where r.depth < p_depth and (r.depth = 0 or r.node not in (select hash from hubs))
  )
  select distinct e.src_hash, e.src_type, e.src_display, e.dst_hash, e.dst_type, e.dst_display, e.relation, e.evidence
  from active_edges e
  where e.src_hash in (select node from reach) and e.dst_hash in (select node from reach)
$$;
