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
| `USAGE_CHECK_PER_DAY`, `USAGE_TRANSCRIBE_PER_DAY`, `USAGE_GRAPH_PER_DAY`, `USAGE_CONTEST_PER_DAY`, `USAGE_GLOBAL_LLM_PER_DAY` | abuse guard | 40, 10, 100, 3, 1500 |

`SUPABASE_ANON_KEY` is not read by the code; do not set it in Vercel. Never prefix any of these with `NEXT_PUBLIC_`.

Check which names are set locally without printing values:

```powershell
node -e "process.loadEnvFile('.env.local'); for (const k of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','REPORT_HASH_PEPPER','ETHERSCAN_API_KEY','TG_HOST','TG_SECRET','OPENAI_API_KEY']) console.log(k + ': ' + (process.env[k] ? 'SET' : 'MISSING'))"
```

## 2b. Security headers and the CSP trade-off

Every response carries a Content Security Policy (browser rules for what a page may load) plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` and a `Permissions-Policy` that turns off camera, microphone, location, payment and USB. Source: `web/src/lib/security-headers.ts`.

Trade-off, in plain words: **inline scripts are allowed** (`script-src 'self' 'unsafe-inline'`) because Next.js 16 writes its page data and start-up code into the HTML as small inline `<script>` tags (checked in the build output on 2026-10-29: 8 on `/`, 14 on `/about`); blocking them would stop the app from working. **No remote scripts are allowed**: no other origin appears anywhere in the policy, so a script from another website cannot load. `'unsafe-eval'` is added only in development. A stricter nonce-based policy would make every page render per request (no static pages), so it was not chosen.

Check a running server: `npx tsx scripts/check-headers.ts <base-url>` prints PASS/FAIL per header (48 checks over `/`, `/about`, `/api/health`).

## 3. Supabase SQL (in order, SQL editor -> New query)

1. All of `web/db/schema.sql` -> Run. Idempotent (`if not exists`, `create or replace`, `add column if not exists`), safe to re-run after every pull.
2. All of `web/db/supabase-grants.sql` -> Run. Enables RLS and limits every table and function to the service role.
3. Check: `select * from increment_usage('test:manual', 5);` returns `allowed = true, remaining = 4`; then `delete from usage_counters where key = 'test:manual';`.
4. All of `web/db/migrations/002_contest_policy.sql` -> Run (round 2: contested reports stay visible and labelled). Idempotent. Check: `select count(*) from contests;` runs without error. Before it is run, the code falls back to the old reading function and refuses new contests. Future schema changes go into `web/db/migrations/NNN_name.sql`, run in number order after `schema.sql`.
5. Demo data was seeded once already. **Do not re-run** `scripts/graph-demo.ts --supabase` on the live project.
6. Contest moderation (uphold / dismiss / remove): `docs/MODERATION.md`.

## 4. TigerGraph (Savanna)

Commands already in the repo, run after the Supabase SQL:

```powershell
npx tsx scripts/tg-setup.ts          # schema migration, install Q1-Q4, load data from Supabase, parity check
npx tsx scripts/tg-setup.ts --load   # reload data only (e.g. if a live upsert failed)
```

`tg-setup.ts` must end with `parity TigerGraph vs Postgres: N/N queries SAME`. Leave the starter `Transaction_Fraud` graph in the workspace alone.

## 5. Before a demo

- **Warm TigerGraph** 10 minutes before: in Savanna, make sure the workspace is *Running* (resume it if it is suspended). Then in the app run sample 1 and press "Show links for upi ...". The first call may show "The graph database is waking up..."; repeat until the note under the graph says `Graph backend: tigergraph`. If TigerGraph cannot be woken, the app answers from Postgres and says `postgres (TigerGraph unavailable)`.
- **Warm the functions:** `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app` (uses 3 of your network's 40 daily checks) must end with `ALL PASS`.
- **Keep Supabase awake:** free Supabase projects are paused after a period of inactivity (about a week at the time of writing). Real database traffic keeps it active: any check (it queries reports) counts. Run the smoke script, or open the app and run a sample, at least every few days, especially in the 48 hours before judging. If it is paused, restore it from the Supabase dashboard; the app shows "Reports database unavailable ... not a clean result" until it is back.

## 6. After deploying

Run, against the live URL: `npx tsx scripts/smoke-live.ts <url>` (expect `ALL PASS (36 expectations)`) and `npx tsx scripts/check-headers.ts <url>` (expect `ALL PASS (48 checks)`). The UI has no web fonts and no third-party requests (system fonts only, round 2), so nothing besides the app itself needs to be allowed by the CSP.

## 7. Rollback

Vercel -> Deployments -> pick the last good deployment -> **Promote to Production** (instant, no rebuild). The SQL in `schema.sql` only adds tables, columns and functions, so an older deployment keeps working against the newer schema. To roll the code back in git: `git revert <commit>` on `main` and push; Vercel redeploys automatically. Then verify with `curl.exe -s https://scam-lens-two.vercel.app/api/health` and the smoke script.
