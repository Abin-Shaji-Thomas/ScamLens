-- 002: contest policy (round 2, G2). Run AFTER db/schema.sql, in the Supabase SQL editor. Idempotent.
-- Before: contesting hid an identifier's Reported badge from everyone (anyone could erase evidence).
-- After: a contested entry stays visible, labelled "Contested, under review", and never counts toward High.
-- Only a moderator (you, in the SQL editor; see docs/MODERATION.md) can uphold a contest (remove the reports)
-- or dismiss it (clear the label).

create table if not exists contests (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  reason text not null check (char_length(reason) between 10 and 500),
  status text not null default 'pending' check (status in ('pending','upheld','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists contests_hash on contests (identifier_hash);
create index if not exists contests_status on contests (status, created_at);

-- Records a contest and labels the reports. It hides nothing.
create or replace function contest_identifier_v2(p_hash text, p_reason text)
returns table (updated int) language plpgsql as $$
declare n int;
begin
  insert into contests (identifier_hash, reason) values (p_hash, left(p_reason, 500));
  update reports set contested = true where identifier_hash = p_hash;
  get diagnostics n = row_count;
  return query select n;
end $$;

-- Same as reported_counts, but contested identifiers are returned (with contested = true) instead of hidden.
create or replace function reported_counts_v2(p_hashes text[])
returns table (identifier_hash text, identifier_type text, identifier_display text, reporters int,
               categories text[], first_reported timestamptz, last_reported timestamptz, synthetic boolean, contested boolean)
language sql stable as $$
  select r.identifier_hash, min(r.identifier_type), min(r.identifier_display),
         count(distinct r.reporter_fingerprint_hash)::int, array_agg(distinct r.category order by r.category),
         min(r.created_at), max(r.created_at), bool_or(r.synthetic), bool_or(r.contested)
  from reports r
  where r.identifier_hash = any(p_hashes)
    and r.expires_at > now() and r.created_at > now() - interval '90 days'
  group by r.identifier_hash
  having count(distinct r.reporter_fingerprint_hash) >= 2
$$;

-- Supabase only: lock the new table and functions to the service role (same pattern as supabase-grants.sql).
-- Wrapped so the file also runs on plain Postgres/PGlite, where these roles do not exist.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'alter table contests enable row level security';
    execute 'revoke all on contests from anon, authenticated';
    execute 'revoke execute on function contest_identifier_v2(text, text), reported_counts_v2(text[]) from public, anon, authenticated';
    execute 'grant execute on function contest_identifier_v2(text, text), reported_counts_v2(text[]) to service_role';
  end if;
end $$;
