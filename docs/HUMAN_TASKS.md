# Human tasks (in order)

Things the automated runs cannot do (no dashboard access, no logins). The app keeps working without them; the fallback is noted for each. State as of the TigerGraph finish round (2026-10-30): the Supabase migrations are run, TigerGraph setup is done (`19/19 queries SAME`), and AI stays off by the owner's decision. What remains are routine checks after a deploy, keeping TigerGraph awake for demos, a monthly clean-up, and checks only a person can do.

## 1. Supabase SQL (DONE 2026-10-30) and the monthly clean-up
Done: the owner ran `web/db/schema.sql`, `web/db/supabase-grants.sql`, `web/db/migrations/002_contest_policy.sql` and `web/db/migrations/003_contest_retention.sql` in the Supabase SQL editor. If the database is ever recreated, run those four files again in that order (all are idempotent), then check `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4` and `delete from usage_counters where key = 'test:manual';`.
Recurring: once a month run `select * from purge_old_contests();` (see `docs/MODERATION.md` section 5). Until it runs, old contest reasons are simply kept.

## 2. After each push: confirm the live build
`curl.exe -s https://scam-lens-two.vercel.app/api/health` must show `"build"` equal to `git rev-parse --short HEAD` (first 7 characters). If not, open Vercel -> Deployments and check the latest deployment. Rollback: Vercel -> Deployments -> choose the previous Ready deployment -> **Promote to Production**.
Optional in the same visit (Vercel -> Settings): Function Region = Mumbai (`bom1`); remove `SUPABASE_ANON_KEY` (unused).

## 3. Before a demo: keep TigerGraph awake
Setup is done (the owner applied global migration 001 by hand; `tg-setup.ts` then reported `19/19 queries SAME`). Savanna has no auto-start, so an idle workspace suspends. Shortly before a demo or judging: TigerGraph Savanna -> Workspaces -> ScamLens -> **Resume**, then in the app run sample 1 and press "Show links for upi ..." until the note says `Graph backend: tigergraph (N ms)`. Fallback while suspended: Postgres, labelled `postgres (TigerGraph unavailable)`.
If `npx tsx scripts/tg-setup.ts` ever stops with "HUMAN STEP REQUIRED", paste the GSQL it prints into the Savanna GSQL editor and run it again.

## 4. After each push: smoke-test the live URL
`cd web` then `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`. It warms the site up first, then expects `ALL PASS` (39 expectations at the last live run; the warm-up is not counted). It uses 4 of your network's 40 daily checks.

## 5. After each push: check the security headers
`npx tsx scripts/check-headers.ts https://scam-lens-two.vercel.app`. Expect `ALL PASS (48 checks)`.

## 6. UI checks that need a person
Most of `docs/UI_CHECKLIST.md` was verified in headless Edge on 2026-10-30. Still needed, on the live URL, ideally on a phone and a Mac too:
1. Hover a tier card: its top rule turns tan (on the beige "What to do now" band, hovered links turn clay).
2. Screen reader (NVDA or VoiceOver): "Result ready: ..." is announced; the 01/02/03 and 404 numerals are not read.
3. DevTools -> Network -> Offline, press Check: "Error. ..." appears in black, with no stack trace.
4. With TigerGraph suspended, press "Show links ...": "The graph database is waking up..." appears after about 3 s.
5. On macOS, iOS, Android and Linux, check that the headings look like Windows: solid regular Arial (or its metric-compatible fallback), not a thin face.
6. "I already paid" -> COPY COMPLAINT DRAFT in a real browser: the draft lands on the clipboard (headless Edge blocks the clipboard, so only the on-page fallback was verified).

## Later / optional
- **Add an AI key later, if wanted** (not needed; ScamLens is rules-only by design right now): set `OPENAI_API_KEY`, `OPENAI_MODEL` (and `OPENAI_VISION_MODEL` if needed, `OPENAI_BASE_URL` for other providers) in `web/.env.local` and in Vercel, then redeploy. The AI pass and screenshot reading switch on automatically (`/api/health` shows `"llm": true`). Then run `npx tsx scripts/smoke-transcribe.ts <your-own-synthetic-screenshot.png> --show` (must print `PASS`) and `npm run eval` in both modes before claiming any benefit.
- **Share previews** (optional): if link previews show the wrong host, set `NEXT_PUBLIC_SITE_URL=https://scam-lens-two.vercel.app` in Vercel (not a secret) and redeploy.
- **Moderating contests**: `docs/MODERATION.md` (list, uphold, dismiss, remove; TigerGraph clean-up after an uphold).
- **Before judging**: keep Supabase awake and warm TigerGraph as in `docs/DEPLOY.md` section 5.
- **Showing Q2 in a demo**: paste the demo wallet `0x93776c64a1e60f64dec9cb7bcf0638c4ffe432d8` (a labelled 2-hop demo path); no seeding is needed.
