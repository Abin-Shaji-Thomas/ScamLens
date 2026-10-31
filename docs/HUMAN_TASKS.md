# Human tasks (in order)

Things the automated runs cannot do (no dashboard access, no logins). The app keeps working without them; each item says what happens until it is done. State as of the final round (2026-10-31): Supabase migrations 002 and 003 are run, TigerGraph setup is done and the Indian demo dataset is loaded (`63/63 queries SAME`), AI stays off by the owner's decision. Numbers marked in this file are checked against the code by `npm run docs:check`.

## 1. Run migration 004, then re-seed the demo cases (once)
1. In the Supabase SQL editor run all of `web/db/migrations/004_cases_and_feedback.sql` (idempotent), then `select count(*) from cases;`.
2. `cd web`, then `npx tsx scripts/seed-india-cases.ts --apply`: it should now print `"migration004":true` and 56 case rows.
3. `npx tsx scripts/tg-setup.ts --load`: expect `parity ... queries SAME` and every dataset check PASS.

Until then: "This was a real scam, add it to the map" and "Was this right?" say "Contributing is not available right now."; the scam trail counts come from reports (no channels, loss bands or months). Everything else works.

## 2. Before a demo: wake TigerGraph
Savanna has no auto-start, so an idle workspace suspends. Shortly before a demo or judging: TigerGraph Savanna -> Workspaces -> ScamLens -> **Resume**. Then run sample 1 on the live site: the scam trail should say "Checked with tigergraph in N ms", and /about should end the Link graph section with "... counted by TigerGraph."
Until then: the trail and the graph answer from Postgres, labelled `postgres (TigerGraph unavailable)`.
If `npx tsx scripts/tg-setup.ts` ever stops with "HUMAN STEP REQUIRED", paste the GSQL it prints into the Savanna GSQL editor and run it again (graph migrations so far: <!-- FACT:graph_migrations -->`001_report_reporter_key.gsql`<!-- /FACT -->, applied).

## 2b. Before filming the demo video, and after
Before: resume TigerGraph (item 2), then `cd web && npx tsx scripts/tg-setup.ts --load` (expect every query SAME). Paste `docs/demo/video-sms.txt`; expect High. After filming: `npx tsx scripts/seed-india-cases.ts --remove` removes the demo-video campaign and the 56-case dataset (only their own rows).

## 3. Choose and add a LICENSE
The repository has no licence file. Choose one and add `LICENSE` at the root. Note that the bundled ScamSniffer address snapshot is GPL-3.0 (attribution kept in `/about` and `docs/THIRD_PARTY.md`), which matters for the choice.

## 4. After each push: confirm the build, then smoke-test
1. `curl.exe -s https://scam-lens-two.vercel.app/api/health` must show `"build"` equal to the first 7 characters of `git rev-parse --short HEAD`. If not, open Vercel -> Deployments. Rollback: pick the previous Ready deployment -> **Promote to Production**.
2. `cd web`, then `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`: it warms up, then expects `ALL PASS` with <!-- FACT:smoke_expectations -->39<!-- /FACT --> expectations (receipts on). It uses 4 of your network's daily checks.
3. `npx tsx scripts/check-headers.ts https://scam-lens-two.vercel.app`: expect `ALL PASS (48 checks)`.

## 5. Weekly: read the project mailbox
Check <!-- FACT:contact_email -->scamlenspvt@gmail.com<!-- /FACT --> (and <!-- FACT:x_handle -->@scamlens<!-- /FACT --> on X) once a week for deletion, correction and contest requests; handle them with `docs/MODERATION.md`. No response time is promised on the site.

## 6. Monthly: clean-up functions
In the Supabase SQL editor: `select * from purge_old_contests();` and, after migration 004, `select * from purge_expired_cases();` (expired cases, orphan excerpts, old feedback). Until they run, old rows are simply kept a little longer.

## 7. Only if the database is ever recreated
Run `web/db/schema.sql`, `web/db/supabase-grants.sql` and then the migrations in order (<!-- FACT:db_migrations -->`002_contest_policy.sql`, `003_contest_retention.sql`, `004_cases_and_feedback.sql`<!-- /FACT -->, all in `web/db/migrations/`). All are idempotent. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`, then `delete from usage_counters where key = 'test:manual';`. Then seed the demo data again (item 1).

## 8. Checks only a person can do
Most of `docs/UI_CHECKLIST.md` was verified in headless Edge. Still needed, on the live URL, ideally on a phone and a Mac too:
1. Hover a tier card: its top rule turns tan (on the beige "What to do now" band, hovered links turn clay).
2. Screen reader (NVDA or VoiceOver): "Result ready: ..." is announced; the 01/02/03 and 404 numerals are not read.
3. DevTools -> Network -> Offline, press Check: "Error. ..." appears in black, with no stack trace.
4. On macOS, iOS, Android and Linux: the headings look like Windows, solid regular Arial (or its metric-compatible fallback), not a thin face.
5. In a real browser: "Copy complaint draft", "Download signed receipt" and "Copy delete code" land on the clipboard or disk (headless Edge blocks the clipboard and downloads).
6. After migration 004: add a clearly synthetic test case on the live site, copy its delete code, and delete it on /privacy.
7. Pick any of the <!-- FACT:rule_count -->19<!-- /FACT --> patterns on /patterns, press "Try this example", then Check: the result lists that pattern under Suspected.

## Later / optional
- **Vercel settings** (one visit): Function Region = Mumbai (`bom1`); remove `SUPABASE_ANON_KEY` (unused).
- **Add an AI key, if ever wanted** (not needed; ScamLens is rules-only by decision): set `OPENAI_API_KEY` and `OPENAI_MODEL` in `web/.env.local` and in Vercel, then redeploy; run `npx tsx scripts/smoke-transcribe.ts <your-own-synthetic-screenshot.png> --show` and `npm run eval` in both modes before claiming any benefit.
- **Share previews**: if link previews show the wrong host, set `NEXT_PUBLIC_SITE_URL=https://scam-lens-two.vercel.app` in Vercel (not a secret) and redeploy.
- **Brand assets**: if `web/src/app/icon.svg` changes, run `npx tsx scripts/export-brand-assets.ts http://localhost:3000` against a local production build and commit `docs/assets/` and `web/src/app/apple-icon.png`.
- **Removing the demo dataset**: `npx tsx scripts/seed-india-cases.ts --remove` (only its own rows; TigerGraph copies need `docs/MODERATION.md` section 4).
