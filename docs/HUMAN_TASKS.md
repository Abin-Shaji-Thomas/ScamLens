# Human tasks (in order)

Things the automated runs cannot do (no dashboard access, no logins). The app keeps working without them; the fallback is noted for each. As of the UI round (2026-10-30): rounds 1 and 2 are on `origin/main` and live (`/api/health` answered `ok:true`, `usageStore: supabase`, `graph: tigergraph` before this round's push). The UI round (branch `ui-swiss`) is pushed by the same run if every check passes; see docs/PROGRESS.md (U6).

## 1. Supabase SQL: base schema, grants, then migration 002 (if not done yet; status UNKNOWN to the automated run)
Why: round 1 added `graph_edges.reporter_key`, `usage_counters` and `increment_usage`; round 2 adds the `contests` table and `contest_identifier_v2` / `reported_counts_v2` (contested entries stay visible, labelled).
Fallback until done: the live functions keep their old behaviour; daily limits count in memory per server; contested entries stay hidden (old policy) and new contests are refused with "Contesting is not available right now" (so nothing new can be hidden).
Steps (Supabase -> SQL Editor -> New query, one file per run, in this order; all are idempotent):
1. All of `web/db/schema.sql` -> Run.
2. All of `web/db/supabase-grants.sql` -> Run.
3. All of `web/db/migrations/002_contest_policy.sql` -> Run.
4. All of `web/db/migrations/003_contest_retention.sql` -> Run (contest retention, final round). Then once a month: `select * from purge_old_contests();` (see `docs/MODERATION.md` section 5). Until it runs, contest reasons are simply kept (old behaviour).
5. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`; then `delete from usage_counters where key = 'test:manual';`. And `select count(*) from contests;` returns `0` without error.

## 2. Confirm the live build after a push
`curl.exe -s https://scam-lens-two.vercel.app/api/health` must show `"build"` equal to `git rev-parse --short HEAD` (first 7 characters). If not, open Vercel -> Deployments and check the latest deployment. Rollback: Vercel -> Deployments -> choose the previous Ready deployment -> **Promote to Production**.
Optional in the same visit (Vercel -> Settings): Function Region = Mumbai (`bom1`); remove `SUPABASE_ANON_KEY` (unused); optional AI variables are listed in `docs/DEPLOY.md` section 2.

## 3. Resume TigerGraph and run the setup script
Why: on 2026-10-30 the workspace did not wake: `/restpp/echo` returned HTTP 500 "Failed to start workspace. Auto start is not enabled for this workspace." for 5 minutes, so `tg-setup.ts` (round 1's two-reporter queries) has still not been compiled live. Fallback until done: the graph answers from Postgres and says `postgres (TigerGraph unavailable)` (confirmed through the app the same day).
Steps:
1. TigerGraph Savanna -> Workspaces -> the ScamLens workspace -> **Resume** (and, if offered, turn on **Auto start** so it wakes on the first request).
2. `cd web` then `npx tsx scripts/tg-setup.ts`. It must end with `parity TigerGraph vs Postgres: N/N queries SAME`. If GSQL fails to compile, copy the exact error into an issue; the Postgres fallback keeps working.
3. In the app, run sample 1 and press "Show links for upi ..." until the note under the graph says `Graph backend: tigergraph`.

## 4. Smoke-test the live URL
`cd web` then `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`. Expect `ALL PASS (36 expectations)` (passed against `npm run start` locally on 2026-10-29 with the live Supabase, TigerGraph and Etherscan keys).

## 5. Check the security headers on the live URL
`npx tsx scripts/check-headers.ts https://scam-lens-two.vercel.app`. Expect `ALL PASS (48 checks)` (passed against `npm run start` locally).

## 6. UI checks that need a person
Most of `docs/UI_CHECKLIST.md` was verified in headless Edge on 2026-10-30 (layout at 375-1920 px, focus order and outline, reduced motion, print, 200% zoom, contrast, console). Still needed, on the live URL, ideally on a phone and a Mac too:
1. Hover a tier card: its top rule turns tan (on the beige "What to do now" band, hovered links turn clay).
2. Screen reader (NVDA or VoiceOver): "Result ready: ..." is announced; the 01/02/03 and 404 numerals are not read.
3. DevTools -> Network -> Offline, press Check: "Error. ..." appears in black, with no stack trace.
4. With TigerGraph suspended, press "Show links ...": "The graph database is waking up..." appears after about 3 s.
5. On macOS or iOS, check that the big headings render in a light weight (Helvetica Neue Light); on Windows they are regular weight (see the font question in the UI round handoff).

## Later / optional
- **Add an AI key later, if wanted** (not needed; ScamLens is rules-only by design right now): set `OPENAI_API_KEY`, `OPENAI_MODEL` (and `OPENAI_VISION_MODEL` if needed, `OPENAI_BASE_URL` for other providers) in `web/.env.local` and in Vercel, then redeploy. The AI pass and screenshot reading switch on automatically (`/api/health` shows `"llm": true`). Then run `npx tsx scripts/smoke-transcribe.ts <your-own-synthetic-screenshot.png> --show` (must print `PASS`) and `npm run eval` in both modes before claiming any benefit.
- **Share previews** (optional): if link previews show the wrong host, set `NEXT_PUBLIC_SITE_URL=https://scam-lens-two.vercel.app` in Vercel (not a secret) and redeploy.
- **Moderating contests**: `docs/MODERATION.md` (list, uphold, dismiss, remove; TigerGraph clean-up after an uphold).
- **Before judging**: keep Supabase awake and warm TigerGraph as in `docs/DEPLOY.md` section 5.
