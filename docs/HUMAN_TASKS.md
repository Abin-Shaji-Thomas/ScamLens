# Human tasks (in order)

Things the automated runs cannot do (no dashboard access, no logins). The app keeps working without them; each item says what happens until it is done. State as of the finish round (2026-10-30): the Supabase SQL is run, TigerGraph setup is done (`19/19 queries SAME`), and AI stays off by the owner's decision. Numbers marked in this file are checked against the code by `npm run docs:check`.

## 0. Run migration 004 (once, new in the final round)
In the Supabase SQL editor run all of `web/db/migrations/004_cases_and_feedback.sql` (idempotent), then `select count(*) from cases;`. Until then the "add it to the map" panel says "Contributing is not available right now." and nothing else changes. Then run `cd web && npx tsx scripts/seed-india-cases.ts --apply` again so the 56 demo cases also get their `cases` rows (counts by channel, loss band and month).

## 1. Before a demo: wake TigerGraph
Savanna has no auto-start, so an idle workspace suspends. Shortly before a demo or judging: TigerGraph Savanna -> Workspaces -> ScamLens -> **Resume**. Then on the live site run sample 1 and press "Show links for upi ..." until the note says `Graph backend: tigergraph (N ms)`, and open /about: the "Link graph" section should end with "... counted by TigerGraph."
Until then: lookups answer from Postgres, labelled `postgres (TigerGraph unavailable)`.
If `npx tsx scripts/tg-setup.ts` ever stops with "HUMAN STEP REQUIRED", paste the GSQL it prints into the Savanna GSQL editor and run it again (graph migrations so far: <!-- FACT:graph_migrations -->`001_report_reporter_key.gsql`<!-- /FACT -->, applied by the owner).

## 2. After each push: confirm the build, then smoke-test
1. `curl.exe -s https://scam-lens-two.vercel.app/api/health` must show `"build"` equal to the first 7 characters of `git rev-parse --short HEAD`. If not, open Vercel -> Deployments. Rollback: pick the previous Ready deployment -> **Promote to Production**.
2. `cd web`, then `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`: it warms up, then expects `ALL PASS` with <!-- FACT:smoke_expectations -->39<!-- /FACT --> expectations (receipts on). It uses 4 of your network's daily checks.
3. `npx tsx scripts/check-headers.ts https://scam-lens-two.vercel.app`: expect `ALL PASS (48 checks)`.

## 3. Monthly: clean up old contests and cases
In the Supabase SQL editor run `select * from purge_old_contests();` and, after migration 004, `select * from purge_expired_cases();` (see `docs/MODERATION.md` section 5). Until it runs, old contest reasons are simply kept.

## 4. Only if the database is ever recreated
Run `web/db/schema.sql`, `web/db/supabase-grants.sql` and then the migrations in order (<!-- FACT:db_migrations -->`002_contest_policy.sql`, `003_contest_retention.sql`, `004_cases_and_feedback.sql`<!-- /FACT -->, all in `web/db/migrations/`) in the Supabase SQL editor. All are idempotent. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`, then `delete from usage_counters where key = 'test:manual';`.

## 5. Checks only a person can do
Most of `docs/UI_CHECKLIST.md` was verified in headless Edge on 2026-10-30. Still needed, on the live URL, ideally on a phone and a Mac too:
1. Hover a tier card: its top rule turns tan (on the beige "What to do now" band, hovered links turn clay).
2. Screen reader (NVDA or VoiceOver): "Result ready: ..." is announced; the 01/02/03 and 404 numerals are not read.
3. DevTools -> Network -> Offline, press Check: "Error. ..." appears in black, with no stack trace.
4. With TigerGraph suspended, press "Show links ...": "The graph database is waking up..." appears after about 3 s.
5. On macOS, iOS, Android and Linux: the headings look like Windows, solid regular Arial (or its metric-compatible fallback), not a thin face.
6. In a real browser: "I already paid" -> COPY COMPLAINT DRAFT, and "Download signed receipt" under Share proof, both land (headless Edge blocks the clipboard and downloads, so only the on-page parts were verified).
7. Pick any of the <!-- FACT:rule_count -->18<!-- /FACT --> patterns on /patterns, press "Try this example", then Check: the result lists that pattern under Suspected.

## Later / optional
- **Vercel settings** (one visit): Function Region = Mumbai (`bom1`); remove `SUPABASE_ANON_KEY` (unused).
- **Add an AI key, if ever wanted** (not needed; ScamLens is rules-only by decision): set `OPENAI_API_KEY` and `OPENAI_MODEL` (and `OPENAI_VISION_MODEL`, `OPENAI_BASE_URL` if needed) in `web/.env.local` and in Vercel, then redeploy. The AI pass and screenshot reading switch on (`/api/health` shows `"llm": true`). Then run `npx tsx scripts/smoke-transcribe.ts <your-own-synthetic-screenshot.png> --show` (must print `PASS`) and `npm run eval` in both modes before claiming any benefit.
- **Share previews**: if link previews show the wrong host, set `NEXT_PUBLIC_SITE_URL=https://scam-lens-two.vercel.app` in Vercel (not a secret) and redeploy.
- **Moderating contests**: `docs/MODERATION.md` (list, uphold, dismiss, remove; TigerGraph clean-up after an uphold).
- **Before judging**: keep Supabase awake and warm TigerGraph as in `docs/DEPLOY.md` section 5.
- **Showing Q2 in a demo**: paste the demo wallet `0x93776c64a1e60f64dec9cb7bcf0638c4ffe432d8` (a labelled 2-hop demo path); no seeding is needed.
