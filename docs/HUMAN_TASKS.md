# Human tasks (in order)

Things the automated run cannot do (no dashboard access). The app keeps working without them, with the fallback noted for each.

## 1. Re-run the SQL in Supabase (after F1, before pushing the new code)
Why: F1 adds `graph_edges.reporter_key` (backfilled from existing reports) and makes Q1/Q3 require two different reporters.
Fallback until done: the live Postgres functions keep the old behaviour; `scripts/tg-setup.ts --load` fails with a "database read graph_edges failed" message because the column is missing.
Steps:
1. Supabase dashboard -> SQL Editor -> New query.
2. Paste all of `web/db/schema.sql` -> Run. (Idempotent: `create ... if not exists`, `create or replace`, `add column if not exists`.)
3. Paste all of `web/db/supabase-grants.sql` -> Run.

## 2. Update TigerGraph (after task 1)
Why: Report vertices need the `reporter_key` attribute and Q1/Q3 the new independence rule.
Fallback until done: TigerGraph keeps serving the old queries (links not gated by reporter).
Steps: `cd web` then `npx tsx scripts/tg-setup.ts` — applies `graph/migrations/001_report_reporter_key.gsql`, re-creates and installs Q1-Q4, reloads data from Supabase, and must print `parity TigerGraph vs Postgres: N/N queries SAME`.
Note: the changed GSQL has not been compiled against the live workspace yet (doing so before task 1 would have broken the live demo), so expect to fix compile errors if any appear.

## 3. Usage counters for the abuse guard (F2; covered by task 1 if you run it after this commit)
Why: F2 adds `usage_counters` + `increment_usage(p_key, p_limit)` so daily limits are shared across Vercel instances.
Fallback until done: each server instance counts in memory (limits still apply per instance, reset on cold start); the AI pass is skipped with a notice whenever the shared counter cannot be reached, because a global LLM cap cannot be enforced from memory.
Steps: same as task 1 (run all of `web/db/schema.sql`, then all of `web/db/supabase-grants.sql`). Then check in the SQL editor:
`select * from increment_usage('test:manual', 5);` must return `allowed = true, remaining = 4`; then `delete from usage_counters where key = 'test:manual';`.
