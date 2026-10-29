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

## 4. Smoke-test screenshot reading once (F3; needs a vision-capable key)
Why: tests use a mocked model; the real provider call has not been run.
Fallback until done: without `OPENAI_API_KEY` + a vision model, `/api/transcribe` answers 503 "Screenshot reading is not available right now. Please paste the text of the chat instead." and the UI shows that message; text checks are unaffected.
Steps:
1. In `web/.env.local` set `OPENAI_API_KEY`, `OPENAI_MODEL` and (if the text model cannot read images) `OPENAI_VISION_MODEL`; for a free OpenAI-compatible provider also `OPENAI_BASE_URL`.
2. `cd web` then `npx tsx scripts/smoke-transcribe.ts C:\path\to\a-synthetic-chat-screenshot.png --show` (use a screenshot you made yourself, no real people's data).
3. Expect `PASS: <n> chars ...`. Then set the same variables in Vercel (task 5) to enable it live.

## 5. Vercel settings and env vars (F8)
Why: the new features read new optional variables; the region setting cuts latency for Indian users.
Fallback until done: defaults apply (limits 40/10/100/3 per day, global LLM cap 1500, no AI, no screenshots).
Steps (Vercel -> Project -> Settings), names only, see `docs/DEPLOY.md` section 2:
1. Environment Variables: confirm `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REPORT_HASH_PEPPER`, `ETHERSCAN_API_KEY`, `TG_HOST`, `TG_GRAPH`, `TG_SECRET` are set for Production. Optional: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_BASE_URL`, `USAGE_*_PER_DAY`. Remove `SUPABASE_ANON_KEY` if present (unused).
2. Functions -> Function Region: Mumbai (`bom1`), unless Supabase is far from Mumbai (see DEPLOY.md).

## 6. Push and redeploy
Why: all F2-F8 commits are local only (the run was told not to push).
Steps: run tasks 1 and 3 (SQL) first, then `git push origin main`. Vercel auto-deploys from `main`. Wait for the deployment to show Ready, then check `curl.exe -s https://scam-lens-two.vercel.app/api/health` returns JSON with `"ok":true` and `"usageStore":"supabase"`. Then run task 2 (TigerGraph).

## 7. Smoke-test the live URL
Steps: `cd web` then `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`. Expect `ALL PASS (36 expectations)` (it passed against `npm run start` locally on 2026-10-29). Then click through `docs/UI_CHECKLIST.md` on a phone or at 375 px.

## R2-1. Run migration 002 (contest policy, round 2 G2)
Why: contested entries now stay visible and labelled instead of being hidden.
Fallback until done: the site reads reports with the old function (contested rows stay hidden, as before) and refuses new contests with "Contesting is not available right now", so no new evidence can be hidden.
Steps: Supabase -> SQL Editor -> New query -> paste all of `web/db/migrations/002_contest_policy.sql` -> Run (idempotent; safe to run again). Check: `select count(*) from contests;` returns 0 rows without error. How to review contests: `docs/MODERATION.md`.
