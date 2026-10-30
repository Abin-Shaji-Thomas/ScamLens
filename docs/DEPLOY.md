# Deploying ScamLens

Live: https://scam-lens-two.vercel.app (Vercel, auto-deploys from `main`). All commands run from `web/` in PowerShell.

## 1. Vercel project settings

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework preset | Next.js (auto-detected) |
| Build / install commands | defaults (`next build`, `npm install`) |
| Node.js version | 20.x or newer (the scripts use `process.loadEnvFile` and `import.meta.dirname`; local runs used Node 26) |
| Function region | **Mumbai, `bom1`** (Settings -> Functions -> Function Region). Closest to Indian users; if your Supabase project is in another region, pick the region nearest to Supabase instead, because every check reads the reports database |
| Function max duration | set in code: `maxDuration = 30` on `/api/check` and `/api/transcribe` |

The repo has no `vercel.json`; the region is a dashboard setting, so nothing in git changes it.

## 2. Environment variables (names only; values live in Vercel, never in git)

Required for the full product:

| Name | Used for | Without it |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | reports, contest, graph fallback, shared usage limits | Reported tier "unavailable"; limits per instance in memory |
| `REPORT_HASH_PEPPER` (32+ random chars; never change it after reports exist) | HMAC of identifiers and fingerprints | reports disabled |
| `ETHERSCAN_API_KEY` | on-chain facts (Ethereum, Polygon, Arbitrum) | Etherscan rows "unavailable" |

Optional:

| Name | Used for | Default |
|---|---|---|
| `TG_HOST`, `TG_GRAPH`, `TG_SECRET` | TigerGraph backend for link queries | Postgres fallback |
| `GRAPH_HUB_MAX` | hub filter | 25 |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | AI signal pass | rules only |
| `OPENAI_VISION_MODEL` | screenshot reading | `OPENAI_MODEL`; without a key the UI asks users to paste text |
| `ETHERSCAN_PLAN` (`paid`), `ETHERSCAN_RPS` | BNB Chain + Base; request rate | free plan, 2/s |
| `TRONGRID_API_KEY` | higher TronGrid limits | keyless |
| `REPORTS_MAX_PER_DAY` | reports per fingerprint per day | 5 |
| `USAGE_CHECK_PER_DAY`, `USAGE_TRANSCRIBE_PER_DAY`, `USAGE_GRAPH_PER_DAY`, `USAGE_CONTEST_PER_DAY`, `USAGE_VERIFY_PER_DAY`, `USAGE_GLOBAL_LLM_PER_DAY` | abuse guard (verify = server-side receipt checks; the graph limit also covers `/api/graph/stats` and the background link hints) | 40, 10, 100, 3, 60, 1500 |
| `RECEIPT_SIGNING_KEY` | signed check receipts (section 2a) | receipts off |
| `NEXT_PUBLIC_SITE_URL` | absolute share-preview image URLs (not a secret) | the deployment URL |

`SUPABASE_ANON_KEY` is not read by the code; do not set it in Vercel. Never prefix any secret with `NEXT_PUBLIC_` (only `NEXT_PUBLIC_SITE_URL`, which is public, has it).

Check which names are set locally without printing values:

```powershell
node -e "process.loadEnvFile('.env.local'); for (const k of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','REPORT_HASH_PEPPER','ETHERSCAN_API_KEY','TG_HOST','TG_SECRET','OPENAI_API_KEY']) console.log(k + ': ' + (process.env[k] ? 'SET' : 'MISSING'))"
```

## 2a. Signed check receipts (`RECEIPT_SIGNING_KEY`)

Optional. With it, every successful check returns a signed receipt (Ed25519) that anyone can verify at `/verify` against the public key published at `/.well-known/scamlens-receipt-key.json`. Without it (or with an invalid value) receipts are simply off and `/api/health` shows `"receipts": false`.

Generate your own key once, on your own machine (it prints the secret to your terminal only; do not paste it anywhere else):

```powershell
node -e "const {generateKeyPairSync}=require('crypto');console.log(generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64'))"
```

Put the one-line output into `web/.env.local` as `RECEIPT_SIGNING_KEY=...` and into Vercel (Production and Preview), then redeploy. Check without revealing it: `node -e "const k=require('crypto').createPrivateKey({key:Buffer.from(process.env.K,'base64'),format:'der',type:'pkcs8'});console.log(k.asymmetricKeyType==='ed25519'?'valid ed25519':'INVALID')"` with `K` set to the value. Rotating the key makes older receipts show "wrong key"; keep the old one if you need old receipts to verify.

## 2b. Security headers and the CSP trade-off

Every response carries a Content Security Policy (browser rules for what a page may load) plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` and a `Permissions-Policy` that turns off camera, microphone, location, payment and USB. Source: `web/src/lib/security-headers.ts`.

Trade-off, in plain words: **inline scripts are allowed** (`script-src 'self' 'unsafe-inline'`) because Next.js 16 writes its page data and start-up code into the HTML as small inline `<script>` tags (checked in the build output on 2026-10-29: 8 on `/`, 14 on `/about`); blocking them would stop the app from working. **No remote scripts are allowed**: no other origin appears anywhere in the policy, so a script from another website cannot load. `'unsafe-eval'` is added only in development. A stricter nonce-based policy would make every page render per request (no static pages), so it was not chosen.

Check a running server: `npx tsx scripts/check-headers.ts <base-url>` prints PASS/FAIL per header (48 checks over `/`, `/about`, `/api/health`).

## 3. Supabase SQL (in order, SQL editor -> New query)

1. All of `web/db/schema.sql` -> Run. Idempotent (`if not exists`, `create or replace`, `add column if not exists`), safe to re-run after every pull.
2. All of `web/db/supabase-grants.sql` -> Run. Enables RLS and limits every table and function to the service role.
3. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`; then `delete from usage_counters where key = 'test:manual';`.
4. All of `web/db/migrations/002_contest_policy.sql` -> Run (round 2: contested reports stay visible and labelled). Idempotent. Check: `select count(*) from contests;` runs without error. Before it is run, the code falls back to the old reading function and refuses new contests. Future schema changes go into `web/db/migrations/NNN_name.sql`, run in number order after `schema.sql`.
4b. All of `web/db/migrations/003_contest_retention.sql` -> Run (contest retention: `purge_old_contests()`). Idempotent. Then once a month `select * from purge_old_contests();` (`docs/MODERATION.md` section 5). Both migrations were run on the live project on 2026-10-30.
5. Demo data was seeded once already. **Do not re-run** `scripts/graph-demo.ts --supabase` on the live project.
6. Contest moderation (uphold / dismiss / remove): `docs/MODERATION.md`.

## 4. TigerGraph (Savanna)

Commands already in the repo, run after the Supabase SQL:

```powershell
npx tsx scripts/tg-setup.ts          # check migrations, install Q1-Q4, load data from Supabase, parity check
npx tsx scripts/tg-setup.ts --load   # reload data only (e.g. if a live upsert failed)
```

`tg-setup.ts` must end with `parity TigerGraph vs Postgres: N/N queries SAME`. Leave the starter `Transaction_Fraud` graph in the workspace alone.

One-time global migration: graphs created before round 1 lack `Report.reporter_key`. Adding it is a GLOBAL schema change, which the graph-scoped token (`TG_SECRET`) is not allowed to make. `tg-setup.ts` therefore reads the schema first (`GET /gsql/v1/schema/graphs/<graph>`): if the attribute exists it prints `migration 001 already applied` and goes on; if it is missing it stops with exit code 2 and "HUMAN STEP REQUIRED", printing `graph/migrations/001_report_reporter_key.gsql` to paste into the Savanna GSQL editor (`USE GLOBAL`, then a global schema change job that adds `reporter_key STRING DEFAULT ""`), after which you re-run `tg-setup.ts`. The owner applied it on 2026-10-30. The install step holds one request open for minutes; if Savanna drops it (`fetch failed`), the script retries up to 3 times, because installing is safe to repeat. Savanna has no auto-start: a suspended workspace answers HTTP 500 "Failed to start workspace" until you resume it, and the app answers from Postgres meanwhile.

## 5. Before a demo

- **Warm TigerGraph** 10 minutes before: in Savanna, make sure the workspace is *Running* (resume it if it is suspended). Then in the app run sample 1 and press "Show links for upi ...". The first call may show "The graph database is waking up..."; repeat until the note under the graph says `Graph backend: tigergraph`. If TigerGraph cannot be woken, the app answers from Postgres and says `postgres (TigerGraph unavailable)`.
- **Warm the functions:** `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app` (uses 3 of your network's 40 daily checks) must end with `ALL PASS`.
- **Keep Supabase awake:** free Supabase projects are paused after a period of inactivity (about a week at the time of writing). Real database traffic keeps it active: any check (it queries reports) counts. Run the smoke script, or open the app and run a sample, at least every few days, especially in the 48 hours before judging. If it is paused, restore it from the Supabase dashboard; the app shows "Reports database unavailable ... not a clean result" until it is back.

## 6. After deploying

First confirm the live site runs the commit you pushed: `/api/health` returns `"build"` = the first 7 characters of the deployed commit (Vercel sets `VERCEL_GIT_COMMIT_SHA`; locally it says `"local"`). Compare:

```powershell
git rev-parse --short HEAD
curl.exe -s https://scam-lens-two.vercel.app/api/health
```

The two must match (if git prints more than 7 characters, compare the first 7). `"graph":"tigergraph"` means TigerGraph is configured (`TG_HOST` and `TG_SECRET` set), not that the workspace is awake: health makes no network calls. Whether TigerGraph actually answered shows under the graph ("Graph backend: tigergraph (N ms)" or "postgres (TigerGraph unavailable)") and in the coverage ledger's Link graph row. If they differ after a few minutes, the deployment is still building or failed: check Vercel -> Deployments.

Then run, against the live URL: `npx tsx scripts/smoke-live.ts <url>` (it warms up first, then expects `ALL PASS` with <!-- FACT:smoke_expectations -->39<!-- /FACT --> expectations when receipts are on; it fails if fewer ran) and `npx tsx scripts/check-headers.ts <url>` (expect `ALL PASS (48 checks)`). The UI has no web fonts and no third-party requests (system fonts only, round 2), so nothing besides the app itself needs to be allowed by the CSP.

## 7. Rollback

Vercel -> Deployments -> pick the last good deployment -> **Promote to Production** (instant, no rebuild). The SQL in `schema.sql` only adds tables, columns and functions, so an older deployment keeps working against the newer schema. To roll the code back in git: `git revert <commit>` on `main` and push; Vercel redeploys automatically. Then verify with `curl.exe -s https://scam-lens-two.vercel.app/api/health` and the smoke script.
