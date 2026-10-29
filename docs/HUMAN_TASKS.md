# Human tasks (in order)

Things the automated runs cannot do (no dashboard access, no logins). The app keeps working without them; the fallback is noted for each. As of the UI round (2026-10-30): rounds 1 and 2 are on `origin/main` and live (`/api/health` answered `ok:true`, `usageStore: supabase`, `graph: tigergraph` before this round's push). The UI round (branch `ui-swiss`) is pushed by the same run if every check passes; see docs/PROGRESS.md (U6).

## 1. Supabase SQL: base schema, grants, then migration 002 (if not done yet; status UNKNOWN to the automated run)
Why: round 1 added `graph_edges.reporter_key`, `usage_counters` and `increment_usage`; round 2 adds the `contests` table and `contest_identifier_v2` / `reported_counts_v2` (contested entries stay visible, labelled).
Fallback until done: the live functions keep their old behaviour; daily limits count in memory per server; contested entries stay hidden (old policy) and new contests are refused with "Contesting is not available right now" (so nothing new can be hidden).
Steps (Supabase -> SQL Editor -> New query, one file per run, in this order; all are idempotent):
1. All of `web/db/schema.sql` -> Run.
2. All of `web/db/supabase-grants.sql` -> Run.
3. All of `web/db/migrations/002_contest_policy.sql` -> Run.
4. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`; then `delete from usage_counters where key = 'test:manual';`. And `select count(*) from contests;` returns `0` without error.

## 2. Confirm the live build after a push
`curl.exe -s https://scam-lens-two.vercel.app/api/health` must show `"build"` equal to `git rev-parse --short HEAD` (first 7 characters). If not, open Vercel -> Deployments and check the latest deployment. Rollback: Vercel -> Deployments -> choose the previous Ready deployment -> **Promote to Production**.
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

## 6. UI checks that need a person
Most of `docs/UI_CHECKLIST.md` was verified in headless Edge on 2026-10-30 (layout at 375-1920 px, focus order and outline, reduced motion, print, 200% zoom, contrast, console). Still needed, on the live URL, ideally on a phone and a Mac too:
1. Hover a tier card: its top rule turns tan (on the beige "What to do now" band, hovered links turn clay).
2. Screen reader (NVDA or VoiceOver): "Result ready: ..." is announced; the 01/02/03 and 404 numerals are not read.
3. DevTools -> Network -> Offline, press Check: "Error. ..." appears in black, with no stack trace.
4. With TigerGraph suspended, press "Show links ...": "The graph database is waking up..." appears after about 3 s.
5. On macOS or iOS, check that the big headings render in a light weight (Helvetica Neue Light); on Windows they are regular weight (see the font question in the UI round handoff).

## Later / optional
- **Screenshot reading** (needs an OpenAI-compatible key with a vision model): set `OPENAI_API_KEY`, `OPENAI_MODEL` (and `OPENAI_VISION_MODEL` if needed, `OPENAI_BASE_URL` for other providers) in `web/.env.local` and in Vercel; then `npx tsx scripts/smoke-transcribe.ts <your-own-synthetic-screenshot.png> --show` must print `PASS`. Without it the UI asks people to paste text.
- **Moderating contests**: `docs/MODERATION.md` (list, uphold, dismiss, remove; TigerGraph clean-up after an uphold).
- **Before judging**: keep Supabase awake and warm TigerGraph as in `docs/DEPLOY.md` section 5.
