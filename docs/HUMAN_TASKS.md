# Human tasks (in order)

Things the automated runs cannot do (no dashboard or browser access). The app keeps working without them; the fallback is noted for each. As of the end of round 2 (2026-10-29): `main` has 9 unpushed round-1 commits and branch `round2` has 5 more on top. Nothing has been pushed.

## 1. Supabase SQL: base schema, grants, then migration 002 (before pushing)
Why: round 1 added `graph_edges.reporter_key`, `usage_counters` and `increment_usage`; round 2 adds the `contests` table and `contest_identifier_v2` / `reported_counts_v2` (contested entries stay visible, labelled).
Fallback until done: the live functions keep their old behaviour; daily limits count in memory per server; contested entries stay hidden (old policy) and new contests are refused with "Contesting is not available right now" (so nothing new can be hidden).
Steps (Supabase -> SQL Editor -> New query, one file per run, in this order; all are idempotent):
1. All of `web/db/schema.sql` -> Run.
2. All of `web/db/supabase-grants.sql` -> Run.
3. All of `web/db/migrations/002_contest_policy.sql` -> Run.
4. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`; then `delete from usage_counters where key = 'test:manual';`. And `select count(*) from contests;` returns `0` without error.

## 2. Merge round2 into main and push
Steps (PowerShell, repo root):
```powershell
git checkout main
git merge --ff-only round2
git push origin main
```
`--ff-only` works because `round2` was branched from the current `main`. Vercel auto-deploys from `main`; wait until the deployment shows **Ready**, then `curl.exe -s https://scam-lens-two.vercel.app/api/health` must return JSON with `"ok":true` and `"usageStore":"supabase"`.
Optional in the same visit (Vercel -> Settings): Function Region = Mumbai (`bom1`); remove `SUPABASE_ANON_KEY` (unused); optional AI variables are listed in `docs/DEPLOY.md` section 2.

## 3. Warm and update TigerGraph
Why: round 1 changed the graph queries (links need two different reporters); they have not been compiled against the live workspace yet.
Steps:
1. TigerGraph Savanna: make sure the workspace is **Running** (resume it if suspended).
2. `cd web` then `npx tsx scripts/tg-setup.ts`. It must end with `parity TigerGraph vs Postgres: N/N queries SAME`. Expect possible GSQL compile errors on the first run; the fallback until fixed is Postgres (the app says `postgres (TigerGraph unavailable)`).
3. In the app, run sample 1 and press "Show links for upi ..." until the note under the graph says `Graph backend: tigergraph`.

## 4. Smoke-test the live URL
`cd web` then `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`. Expect `ALL PASS (36 expectations)` (passed against `npm run start` locally on 2026-10-29 with the live Supabase, TigerGraph and Etherscan keys).

## 5. Check the security headers on the live URL
`npx tsx scripts/check-headers.ts https://scam-lens-two.vercel.app`. Expect `ALL PASS (48 checks)` (passed against `npm run start` locally).

## 6. UI checklist in a real browser
Walk through `docs/UI_CHECKLIST.md` on the live URL: 375 px layout, visual rules, every state, keyboard only, screen reader, 200% zoom, print preview, reduced motion, and the DevTools Console check for Content Security Policy errors. Note anything that fails and ask for a fix.

## Later / optional
- **Screenshot reading** (needs an OpenAI-compatible key with a vision model): set `OPENAI_API_KEY`, `OPENAI_MODEL` (and `OPENAI_VISION_MODEL` if needed, `OPENAI_BASE_URL` for other providers) in `web/.env.local` and in Vercel; then `npx tsx scripts/smoke-transcribe.ts <your-own-synthetic-screenshot.png> --show` must print `PASS`. Without it the UI asks people to paste text.
- **Moderating contests**: `docs/MODERATION.md` (list, uphold, dismiss, remove; TigerGraph clean-up after an uphold).
- **Before judging**: keep Supabase awake and warm TigerGraph as in `docs/DEPLOY.md` section 5.
