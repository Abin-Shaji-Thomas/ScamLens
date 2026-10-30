-- 003: contest retention (final round). Run AFTER 002, in the Supabase SQL editor. Idempotent.
-- Contest reasons are free text written by the person contesting; they are kept only as long as a moderator
-- needs them. purge_old_contests() deletes every contest row (and so its reason) that is already resolved
-- (upheld or dismissed) or older than 90 days. Run it monthly (docs/MODERATION.md section 5).
-- It never touches reports: a "Contested, under review" label set by a purged pending contest stays until a
-- moderator clears it or the reports expire, because only a person may clear a label.
-- The app does not call this function, so the app behaves the same before and after this migration.

create or replace function purge_old_contests()
returns table (deleted int) language plpgsql as $$
declare n int;
begin
  delete from contests
  where status <> 'pending'
     or created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return query select n;
end $$;

-- Supabase only: service role may run it; nobody else (same pattern as 002).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke execute on function purge_old_contests() from public, anon, authenticated';
    execute 'grant execute on function purge_old_contests() to service_role';
  end if;
end $$;
