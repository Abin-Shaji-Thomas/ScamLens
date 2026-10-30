# Operations

## In plain words

ScamLens deploys automatically to Vercel when `main` is pushed. Secrets live in Vercel's environment settings and in a local `web/.env.local` that is never committed. Before a demo, wake TigerGraph and run the smoke script. If a deploy goes wrong, promote the previous deployment in Vercel; it takes seconds.

## Details

### Environment variables (generated from `web/.env.example`; values never in git)
<!-- GENERATED:START env -->
| name | group | what it is (from .env.example) |
|---|---|---|
| `SUPABASE_URL` | Reports (required for the Reported tier, contest and graph) | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Reports (required for the Reported tier, contest and graph) | - |
| `REPORT_HASH_PEPPER` | Reports (required for the Reported tier, contest and graph) | Random secret (32+ chars) used to HMAC identifiers and reporter fingerprints |
| `SUPABASE_ANON_KEY` | Reports (required for the Reported tier, contest and graph) | Not read by the code (the app only uses the service-role key on the server); kept because docs/SPEC.md lists it |
| `ETHERSCAN_API_KEY` | Verified tier | - |
| `ETHERSCAN_RPS` | Verified tier | Optional: requests per second (default 2; the free plan rejects bursts at 3) |
| `ETHERSCAN_PLAN` | Verified tier | Optional: "paid" if your Etherscan plan covers BNB Chain and Base |
| `TRONGRID_API_KEY` | Verified tier | Optional: higher TronGrid rate limits (works without it) |
| `TG_HOST` | Link graph (optional; Postgres fallback otherwise) | TigerGraph Savanna workspace host (https://<id>.i.tgcloud.io), graph name (default ScamLens), database secret |
| `TG_GRAPH` | Link graph (optional; Postgres fallback otherwise) | - |
| `TG_SECRET` | Link graph (optional; Postgres fallback otherwise) | - |
| `GRAPH_HUB_MAX` | Link graph (optional; Postgres fallback otherwise) | Optional: hub filter - nodes with more distinct counterparties than this never link people (default 25) |
| `OPENAI_API_KEY` | AI pass (optional; regex rules only without it) | - |
| `OPENAI_MODEL` | AI pass (optional; regex rules only without it) | - |
| `OPENAI_VISION_MODEL` | AI pass (optional; regex rules only without it) | Optional: model for reading screenshots (must accept images); falls back to OPENAI_MODEL |
| `OPENAI_BASE_URL` | AI pass (optional; regex rules only without it) | Optional: base URL for an OpenAI-compatible provider (blank = OpenAI) |
| `REPORTS_MAX_PER_DAY` | Limits | Optional: max report submissions per reporter per day (default 5) |
| `USAGE_CHECK_PER_DAY` | Limits | Optional: abuse guard (daily, per network fingerprint; counters in Supabase usage_counters, memory fallback) |
| `USAGE_TRANSCRIBE_PER_DAY` | Limits | - |
| `USAGE_GRAPH_PER_DAY` | Limits | - |
| `USAGE_CONTEST_PER_DAY` | Limits | - |
| `USAGE_VERIFY_PER_DAY` | Limits | Optional: server-side receipt checks per network per day (default 60) |
| `USAGE_GLOBAL_LLM_PER_DAY` | Limits | Optional: global daily cap on LLM-using calls (check AI pass + screenshot reading), default 1500 |
| `RECEIPT_SIGNING_KEY` | Signed check receipts (optional; off without it) | Ed25519 private key, base64 PKCS8 DER on one line. Generate your own (docs/DEPLOY.md); never commit or share it. |
| `NEXT_PUBLIC_SITE_URL` | Share preview (optional, not a secret) | Public site URL, e.g. https://scam-lens-two.vercel.app; makes share-image links absolute |
<!-- GENERATED:END env -->

Check which names are set without printing values (from `web/`):
```
node -e "require('fs').readFileSync('.env.local','utf8').split(/\r?\n/).forEach(l=>{const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)console.log(m[1]+': '+(m[2]?'SET':'MISSING'))})"
```

### Deploy
1. Push to `main` (fast-forward only, never force).
2. Vercel builds `web/` (root directory = `web`).
3. `curl.exe -s https://scam-lens-two.vercel.app/api/health` must show `"build"` = `git rev-parse --short HEAD`. `"graph":"tigergraph"` means TigerGraph is configured (`TG_HOST` and `TG_SECRET` set), not that the workspace is awake: health makes no network calls. Whether TigerGraph actually answered shows under the graph ("Graph backend: tigergraph (N ms)" or "postgres (TigerGraph unavailable)") and in the coverage ledger's Link graph row.
4. Run `npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app` and `npx tsx scripts/check-headers.ts https://scam-lens-two.vercel.app`. The first smoke run right after a deploy can time out on a cold start (seen 2026-10-30); run it again before concluding anything.

### Before a demo
- Resume the TigerGraph workspace (Savanna has no auto-start), then run sample 1 and press "Show links" until the note says `Graph backend: tigergraph`. `npx tsx scripts/tg-setup.ts` re-installs the queries, reloads the data and must end with `N/N queries SAME`; it never makes global schema changes (a missing migration stops it with "HUMAN STEP REQUIRED").
- Run the smoke script (it uses 3 of your network's <!-- FACT:checks_per_day -->40<!-- /FACT --> daily checks).
- Keep Supabase awake: free projects pause after inactivity; any check keeps it active.

### Rollback
Vercel -> Deployments -> choose the previous Ready deployment -> Promote to Production. The SQL only adds objects, so an older deployment keeps working against the newer schema.

### Moderation
Contests are reviewed in the Supabase SQL editor with the exact statements in `docs/MODERATION.md`.

### AI and screenshot reading
Off: no `OPENAI_API_KEY` / `OPENAI_MODEL`. `/api/health` reports `"llm": false, "vision": false`; the page shows "Screenshot reading is off. Paste the text instead." and the Suspected tier says "Suspected signals come from fixed pattern rules only.". To turn it on later (optional), set both variables in Vercel and redeploy; the page is built with the same check.

### Human tasks
Everything that needs a dashboard or a person is listed, in order, in `docs/HUMAN_TASKS.md`.

## Where in the code

- `web/.env.example`: variable names.
- `docs/DEPLOY.md`: full deploy and settings guide.
- `docs/MODERATION.md`: moderator SQL.
- `docs/HUMAN_TASKS.md`: open human tasks.
- `web/scripts/smoke-live.ts`, `web/scripts/check-headers.ts`, `web/scripts/tg-setup.ts`: operational scripts.

## How to change it safely

Add a new variable to `web/.env.example` (name and comment only), to Vercel, and to `docs/DEPLOY.md`; run `npm run docs:generate` so the table above updates.

## How it is tested

`web/src/lib/health.test.ts` proves health leaks no values; the live scripts verify a deployment.

## Known limits

The automated runs cannot change Vercel, Supabase or TigerGraph settings; those stay human tasks.
