# API

All routes live under `web/src/app/api`. There is no authentication (no accounts); every route that does work or writes has a daily limit per network fingerprint (HTTP 429 with `Retry-After`), a body size cap (HTTP 413) and zod validation (HTTP 400 with plain issue messages). No response echoes the submitted text, and no response, receipt, evidence pack or log ever contains a contributed excerpt. Schemas named below are in `web/src/lib`.

| Route | Method | Limit (per network per day) | Request | Response | Status codes |
|---|---|---|---|---|---|
| `/api/check` | POST | <!-- FACT:checks_per_day -->40<!-- /FACT --> checks | `CheckRequest`: `{ text }`, 1 to <!-- FACT:max_text_chars -->6,000<!-- /FACT --> characters | `CheckResponse`: identifiers, verified, reported, suspected, ai, risk, notices, checkedAt, optional receipt, trail, feedback | 200, 400, 413, 429 |
| `/api/transcribe` | POST | 10 screenshots (and a global LLM cap) | `{ image }` data URL | `{ text }`; while AI is off: 503 "Screenshot reading is off. Paste the text instead." | 200, 400, 413, 429, 503 |
| `/api/graph` | POST | 100 lookups | `GraphRequest`: `{ type, value }` | `GraphView`: nodes (hash prefixes, masked labels), links, paths with node-id `edges`, backend, elapsedMs, synthetic | 200, 400, 429 |
| `/api/graph/stats` | GET | 100 lookups | none | `{ backend, vertices, edges, asOf }`, 5-minute cache | 200, 404, 429 |
| `/api/report` | POST | reports cap (default 5) | `ReportRequest`: `{ identifiers[], category, consent: true }` | `{ ok, stored, graph }` | 200, 400, 429, 503 |
| `/api/report/contest` | POST | <!-- FACT:contests_per_day -->3<!-- /FACT --> contests | `ContestRequest`: `{ identifier, reason }` (10-500 characters) | `{ ok, updated }` | 200, 400, 429, 503 |
| `/api/case` | POST | 5 cases | `CaseRequest`: `{ identifiers[1-10], category, channel, lossBand, ruleIds, excerpt?, excerptConsent, consent: true }` | `{ ok, stored, graph, deleteCode }` (the code is shown once) | 200, 400, 413, 429, 503 |
| `/api/case/delete` | POST | 5 (shared with cases) | `DeleteCaseRequest`: `{ code, removeReports }` | `{ ok, deleted, reportsRemoved }` | 200, 400, 429, 503 |
| `/api/feedback` | POST | 30 answers | `FeedbackRequest`: `{ identifiers[0-10], verdict, reasons[], ruleIds }` | `{ ok, stored }` | 200, 400, 429, 503 |
| `/api/verify-receipt` | POST | 60 checks | `{ receipt, text? }` | `{ valid, issuedAt?, textMatches? }` | 200, 400, 413, 429 |
| `/api/usage-stats` | GET | none (10-minute cache) | none | `{ checks, days }` | 200, 404 |
| `/api/health` | GET | none | none | booleans and short statuses: db, reports, graph, usageStore, llm, vision, etherscan, build, receipts | 200 |
| `/.well-known/scamlens-receipt-key.json` | GET | none | none | `{ keyId, alg: "Ed25519", publicKey, format }` | 200, 404 |

503 means a dependency is not configured or a migration is missing; the body is a plain sentence. `ruleIds` are checked against the <!-- FACT:rule_count -->18<!-- /FACT --> rule ids; identifiers are re-validated by the extractor on the server.

## Every route and page (generated)

<!-- GENERATED:START routes -->
- /.well-known/scamlens-receipt-key.json (API route, `web/src/app/.well-known/scamlens-receipt-key.json/route.ts`)
- /about (page, `web/src/app/about/page.tsx`)
- /api/case/delete (API route, `web/src/app/api/case/delete/route.ts`)
- /api/case (API route, `web/src/app/api/case/route.ts`)
- /api/check (API route, `web/src/app/api/check/route.ts`)
- /api/feedback (API route, `web/src/app/api/feedback/route.ts`)
- /api/graph (API route, `web/src/app/api/graph/route.ts`)
- /api/graph/stats (API route, `web/src/app/api/graph/stats/route.ts`)
- /api/health (API route, `web/src/app/api/health/route.ts`)
- /api/report/contest (API route, `web/src/app/api/report/contest/route.ts`)
- /api/report (API route, `web/src/app/api/report/route.ts`)
- /api/transcribe (API route, `web/src/app/api/transcribe/route.ts`)
- /api/usage-stats (API route, `web/src/app/api/usage-stats/route.ts`)
- /api/verify-receipt (API route, `web/src/app/api/verify-receipt/route.ts`)
- //icon (image, `web/src/app/icon.svg`)
- //opengraph-image (image, `web/src/app/opengraph-image.tsx`)
- / (page, `web/src/app/page.tsx`)
- /patterns (page, `web/src/app/patterns/page.tsx`)
- /privacy (page, `web/src/app/privacy/page.tsx`)
- /verify (page, `web/src/app/verify/page.tsx`)
<!-- GENERATED:END routes -->

## Limits (generated)

<!-- GENERATED:START limits -->
| limit | value | source |
|---|---|---|
| Text characters per check | 6000 | `MAX_TEXT_CHARS` |
| Image data URL characters | 1500000 | `MAX_IMAGE_DATAURL_CHARS` |
| Identifiers per check | 20 | `MAX_IDENTIFIERS` |
| Graph lookups per result | 10 | `MAX_GRAPH_LOOKUPS` |
| JSON body characters (check) | 13000 | `MAX_JSON_BODY_CHARS` |
| Independent reporters before Reported shows | 2 | `MIN_INDEPENDENT_REPORTERS` |
| Report retention (days) | 90 | `REPORT_RETENTION_DAYS` |
| Reports per network per day (default) | 5 | `DEFAULT_REPORTS_MAX_PER_DAY` / `REPORTS_MAX_PER_DAY` |
| Usage counter retention (days) | 7 | `USAGE_COUNTER_RETENTION_DAYS` |
| Contest reason retention (days, after migration 003) | 90 | `CONTEST_RETENTION_DAYS` |
| Checks per network per day (default) | 40 | `usageLimits` / `USAGE_CHECK_PER_DAY` |
| Screenshot readings per network per day (default) | 10 | `usageLimits` / `USAGE_TRANSCRIBE_PER_DAY` |
| Graph lookups per network per day (default) | 100 | `usageLimits` / `USAGE_GRAPH_PER_DAY` |
| Contests per network per day (default) | 3 | `usageLimits` / `USAGE_CONTEST_PER_DAY` |
| Server-side receipt checks per network per day (default) | 60 | `usageLimits` / `USAGE_VERIFY_PER_DAY` |
| Contributed cases per network per day (default) | 5 | `usageLimits` / `USAGE_CASE_PER_DAY` |
| Was this right? answers per network per day (default) | 30 | `usageLimits` / `USAGE_FEEDBACK_PER_DAY` |
| AI calls per day, all users (default) | 1500 | `usageLimits` / `USAGE_GLOBAL_LLM_PER_DAY` |
| Crypto addresses checked per message | 10 | `MAX_ADDRESSES` |
| Wallets with Etherscan history per message | 1 | `ETHERSCAN_MAX_ADDRESSES` |
| Graph hub filter (max counterparties) | 25 | `DEFAULT_HUB_MAX` / `GRAPH_HUB_MAX` |
<!-- GENERATED:END limits -->
