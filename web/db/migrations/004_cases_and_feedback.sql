-- 004: community cases and feedback (final round P3). Run AFTER 003, in the Supabase SQL editor. Idempotent.
-- A user's ordinary check is never stored. A user may contribute a case with explicit consent: structured facts
-- (category, channel, loss band, month, which patterns fired) and, only if they tick it, a redacted excerpt they
-- reviewed (identifiers replaced by [UPI] [PHONE] [WALLET] [HANDLE] [LINK] [EMAIL], digit runs masked, max 500 chars).
-- The excerpt is for the moderator only: no function here returns it. A case goes through submit_report, so its
-- identifiers become reports and graph links under the same 2-independent-reporter rule.
-- Feedback ("Was this right?") stores a verdict and fixed reason codes per identifier, never free text.
-- The app works before this migration (contributing says it is unavailable; reads fall back to reports only).

create table if not exists cases (
  case_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null, -- the reports.submission_id written by the same contribution
  category text not null check (category in ('investment','task_job','digital_arrest','kyc_refund','romance','lottery','impersonation','other')),
  channel text not null check (channel in ('call','sms','whatsapp','telegram','email','website','app','other')),
  loss_band text not null default 'unknown' check (loss_band in ('none','lt_10k','10k_1l','gt_1l','unknown')),
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), -- server-computed YYYY-MM, never a full date
  rule_ids text[] not null default '{}',
  synthetic boolean not null default false,
  excerpt_redacted text check (excerpt_redacted is null or char_length(excerpt_redacted) <= 500),
  delete_hash text, -- HMAC of the delete code; the code itself is shown once and never stored
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists cases_submission on cases (submission_id);
create index if not exists cases_delete_hash on cases (delete_hash);
create index if not exists cases_expires on cases (expires_at);

create table if not exists feedback (
  identifier_hash text not null, -- an identifier's keyed hash, or 'rules:<sorted rule ids>' for a message without one
  reporter_fingerprint_hash text not null,
  verdict text not null check (verdict in ('scam','genuine','unsure')),
  reasons text[] not null default '{}' check (reasons <@ array['own_id_or_business','know_the_person','company_confirmed','asked_to_pay','lost_money','other']::text[]),
  rule_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (identifier_hash, reporter_fingerprint_hash) -- one network counts once per identifier
);

-- submit_case calls submit_report, whose body uses unqualified names; pin its search_path so it also runs from a
-- function with an empty search_path. Additive: it changes no behaviour of submit_report itself.
alter function public.submit_report(jsonb, text, text, uuid, boolean, int) set search_path = public;

-- One contribution: the reports (and co_reported edges, via submit_report) plus the case row, in one transaction.
create or replace function submit_case(
  p_items jsonb, p_fingerprint text, p_category text, p_submission uuid, p_channel text, p_loss_band text,
  p_month text, p_rule_ids text[], p_excerpt text, p_delete_hash text,
  p_synthetic boolean default false, p_max_per_day int default 5
) returns table (ok boolean, reason text, stored int, case_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  cid uuid;
begin
  select * into r from public.submit_report(p_items, p_fingerprint, p_category, p_submission, p_synthetic, p_max_per_day);
  if not r.ok then
    return query select false, r.reason, 0, null::uuid;
    return;
  end if;
  insert into public.cases (submission_id, category, channel, loss_band, month, rule_ids, synthetic, excerpt_redacted, delete_hash)
  values (p_submission, p_category, p_channel, coalesce(p_loss_band, 'unknown'), p_month, coalesce(p_rule_ids, '{}'),
          p_synthetic, nullif(left(p_excerpt, 500), ''), p_delete_hash)
  returning cases.case_id into cid;
  return query select true, null::text, r.stored, cid;
end $$;

-- Deletes the case (and with it the excerpt) whose delete code hashes to p_delete_hash. With p_remove_reports it also
-- removes the reports and graph links written by the same contribution; otherwise those stay (they are counts only).
create or replace function delete_case_by_code(p_delete_hash text, p_remove_reports boolean default false)
returns table (deleted int, reports_removed int)
language plpgsql security definer set search_path = '' as $$
declare
  sub uuid;
  n int := 0;
  m int := 0;
begin
  if p_delete_hash is null or char_length(p_delete_hash) < 32 then
    return query select 0, 0;
    return;
  end if;
  delete from public.cases c where c.delete_hash = p_delete_hash returning c.submission_id into sub;
  get diagnostics n = row_count;
  if n > 0 and p_remove_reports then
    delete from public.graph_edges e where e.submission_id = sub;
    delete from public.reports rp where rp.submission_id = sub;
    get diagnostics m = row_count;
  end if;
  return query select n, m;
end $$;

-- "Was this right?": one verdict per network per identifier (a repeat replaces the earlier answer).
create or replace function submit_feedback(p_hashes text[], p_fingerprint text, p_verdict text, p_reasons text[], p_rule_ids text[])
returns table (stored int)
language plpgsql security definer set search_path = '' as $$
declare
  h text;
  n int := 0;
begin
  foreach h in array p_hashes loop
    insert into public.feedback (identifier_hash, reporter_fingerprint_hash, verdict, reasons, rule_ids)
    values (h, p_fingerprint, p_verdict, coalesce(p_reasons, '{}'), coalesce(p_rule_ids, '{}'))
    on conflict (identifier_hash, reporter_fingerprint_hash) do update
      set verdict = excluded.verdict, reasons = excluded.reasons, rule_ids = excluded.rule_ids, created_at = now();
    n := n + 1;
  end loop;
  return query select n;
end $$;

-- Display only (never changes a level): how many networks marked each identifier scam, genuine or not sure, in 90 days.
create or replace function feedback_counts(p_hashes text[])
returns table (identifier_hash text, scam int, genuine int, unsure int, genuine_reasons text[])
language sql stable security definer set search_path = '' as $$
  select f.identifier_hash,
         count(*) filter (where f.verdict = 'scam')::int,
         count(*) filter (where f.verdict = 'genuine')::int,
         count(*) filter (where f.verdict = 'unsure')::int,
         coalesce((select array_agg(distinct x order by x) from public.feedback g, unnest(g.reasons) x
                   where g.identifier_hash = f.identifier_hash and g.verdict = 'genuine'
                     and g.created_at > now() - interval '90 days'), '{}')
  from public.feedback f
  where f.identifier_hash = any(p_hashes) and f.created_at > now() - interval '90 days'
  group by f.identifier_hash
$$;

-- Scam trail counts for identifiers that already pass the Reported rule (>= 2 independent reporters in 90 days):
-- linked cases by category, channel, loss band and month, first and last seen, synthetic and real counts apart.
-- No excerpt, no fingerprint, no case id.
create or replace function case_trail_summary(p_hashes text[])
returns table (identifier_hash text, cases int, reporters int, synthetic_cases int, real_cases int,
               categories jsonb, channels jsonb, loss_bands jsonb, months jsonb, first_seen timestamptz, last_seen timestamptz)
language sql stable security definer set search_path = '' as $$
  with eligible as (
    select r.identifier_hash
    from public.reports r
    where r.identifier_hash = any(p_hashes) and r.expires_at > now() and r.created_at > now() - interval '90 days'
    group by r.identifier_hash
    having count(distinct r.reporter_fingerprint_hash) >= 2
  ), linked as (
    select distinct r.identifier_hash, r.reporter_fingerprint_hash, c.case_id, c.category, c.channel, c.loss_band, c.month,
           c.synthetic, c.created_at
    from public.reports r
    join eligible e on e.identifier_hash = r.identifier_hash
    join public.cases c on c.submission_id = r.submission_id and c.expires_at > now()
  ), dims as (
    select l.identifier_hash, d.dim, d.val, count(distinct l.case_id)::int n
    from linked l
    cross join lateral (values ('category', l.category), ('channel', l.channel), ('loss_band', l.loss_band), ('month', l.month)) d(dim, val)
    group by l.identifier_hash, d.dim, d.val
  )
  select l.identifier_hash,
         count(distinct l.case_id)::int,
         count(distinct l.reporter_fingerprint_hash)::int,
         count(distinct l.case_id) filter (where l.synthetic)::int,
         count(distinct l.case_id) filter (where not l.synthetic)::int,
         coalesce((select jsonb_object_agg(d.val, d.n) from dims d where d.identifier_hash = l.identifier_hash and d.dim = 'category'), '{}'::jsonb),
         coalesce((select jsonb_object_agg(d.val, d.n) from dims d where d.identifier_hash = l.identifier_hash and d.dim = 'channel'), '{}'::jsonb),
         coalesce((select jsonb_object_agg(d.val, d.n) from dims d where d.identifier_hash = l.identifier_hash and d.dim = 'loss_band'), '{}'::jsonb),
         coalesce((select jsonb_object_agg(d.val, d.n) from dims d where d.identifier_hash = l.identifier_hash and d.dim = 'month'), '{}'::jsonb),
         min(l.created_at), max(l.created_at)
  from linked l
  group by l.identifier_hash
$$;

-- Monthly (docs/MODERATION.md): expired cases, excerpts whose reports are gone (a moderator removed them), and
-- feedback older than 90 days.
create or replace function purge_expired_cases()
returns table (cases_deleted int, excerpts_cleared int, feedback_deleted int)
language plpgsql security definer set search_path = '' as $$
declare
  a int;
  b int;
  c int;
begin
  delete from public.cases where expires_at < now();
  get diagnostics a = row_count;
  update public.cases cs set excerpt_redacted = null
  where cs.excerpt_redacted is not null
    and not exists (select 1 from public.reports r where r.submission_id = cs.submission_id);
  get diagnostics b = row_count;
  delete from public.feedback where created_at < now() - interval '90 days';
  get diagnostics c = row_count;
  return query select a, b, c;
end $$;

-- Supabase only: lock the new tables and functions to the service role (same pattern as 002 and 003).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'alter table cases enable row level security';
    execute 'alter table feedback enable row level security';
    execute 'revoke all on cases, feedback from anon, authenticated';
    execute 'revoke execute on function submit_case(jsonb, text, text, uuid, text, text, text, text[], text, text, boolean, int), delete_case_by_code(text, boolean), submit_feedback(text[], text, text, text[], text[]), feedback_counts(text[]), case_trail_summary(text[]), purge_expired_cases() from public, anon, authenticated';
    execute 'grant execute on function submit_case(jsonb, text, text, uuid, text, text, text, text[], text, text, boolean, int), delete_case_by_code(text, boolean), submit_feedback(text[], text, text, text[], text[]), feedback_counts(text[]), case_trail_summary(text[]), purge_expired_cases() to service_role';
  end if;
end $$;
