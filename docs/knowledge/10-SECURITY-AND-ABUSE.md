# Security and abuse

## In plain words

ScamLens has no accounts, so it protects itself with hard size limits, daily per-network counters and strict browser security headers. It never stores the text people check, never echoes input in errors, and logs only an event name, a status and a duration. AI output (when enabled) is treated as untrusted: it can only point at known rules with exact quotes, and anything else is dropped.

## Details

### Threat model
| Threat | Defence |
|---|---|
| Flooding the service or the paid APIs | Daily per-fingerprint limits (generated table below); global cap on AI calls; 429 with Retry-After before any external call |
| Huge or malformed input | Body size caps before JSON parsing (413), zod validation (400), plain messages that never echo input |
| Fake "independent" reports | Fingerprint = keyed hash of the IP only; one network counts once; daily report cap; SQL enforces the 2-reporter rule |
| Erasing a true report by contesting it | Contested entries stay visible and labelled; only a person can uphold |
| Linking innocent people through exchanges | Hub filter in every graph query |
| Prompt injection in a chat or screenshot (AI currently off, so no model sees any text) | The model may only return `{rule_id, quote}`; unknown ids and non-verbatim quotes are dropped; identifiers never come from the model; the transcription prompt says not to follow instructions in the image; the user confirms any transcript |
| Script injection / third-party code | CSP with `script-src 'self' 'unsafe-inline'` (Next.js needs inline bootstrap scripts), no remote origins, no `unsafe-eval` in production |
| Clickjacking, sniffing, referrer leaks | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy` |
| Leaking secrets | Secrets only in server code via `process.env`; `/api/health` returns booleans and short statuses (plus a 7-character build id); it makes no network calls, so `"graph":"tigergraph"` means configured, not awake |
| Regex denial of service | `npx tsx scripts/redos-check.ts`: 56 regexes x 20 adversarial 6,000-character inputs, worst case 3.7 ms, 0 cases at or above 200 ms (recorded in `docs/AUDIT.md`; the round 2 re-run measured 4.8 ms) |
| Forged or edited check results | Signed check receipts: canonical JSON (sorted keys) signed with Ed25519 via `node:crypto`; any changed field fails verification; the public key is published at `/.well-known/scamlens-receipt-key.json` with a `keyId` (first 16 hex characters of SHA-256 of the public key); /verify checks in the browser with WebCrypto, else `POST /api/verify-receipt` (20 KB cap, daily per-network limit). Receipts hold no raw text: masked identifiers, findings without quotes, links without addresses, and `textDigest` = HMAC-SHA256 of the normalised text with a key derived from the signing key by HKDF-SHA256. Missing or invalid key: feature off, no crash. See [19-DISTINCTIVE-FEATURES.md](19-DISTINCTIVE-FEATURES.md) |

Limits (generated from `web/src/lib/limits.ts` and `usageLimits`):

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
| AI calls per day, all users (default) | 1500 | `usageLimits` / `USAGE_GLOBAL_LLM_PER_DAY` |
| Crypto addresses checked per message | 10 | `MAX_ADDRESSES` |
| Wallets with Etherscan history per message | 1 | `ETHERSCAN_MAX_ADDRESSES` |
| Graph hub filter (max counterparties) | 25 | `DEFAULT_HUB_MAX` / `GRAPH_HUB_MAX` |
<!-- GENERATED:END limits -->

### Privacy audit (how to repeat it)
- `git grep -n "console\." web/src` must show nothing outside `web/src/lib/log.ts` (a test enforces this).
- The safe logger accepts only an event name and short fields (`web/src/lib/log.ts`).
- Responses never contain the input text: the check response has identifiers, findings and quotes for the user's own view only; receipts carry only an HMAC digest of the text.

## Where in the code

- `web/src/lib/security-headers.ts` and `web/next.config.ts`: headers and CSP.
- `web/src/lib/body.ts` and `web/src/lib/limits.ts`: size caps.
- `web/src/lib/usage.ts`: abuse guard.
- `web/src/lib/log.ts`: safe logging.
- `web/src/lib/signals/validate.ts`: AI output validation.
- `web/src/lib/health.ts`: health without secrets.
- `web/scripts/check-headers.ts` and `web/scripts/redos-check.ts`: live and offline checks.
- `docs/AUDIT.md`: the round 1 audit.

## How to change it safely

Any new route must cap its body, validate with zod, consume the usage guard before external calls, and never echo input. Run `npx tsx scripts/check-headers.ts <url>` after header changes and `npx tsx scripts/redos-check.ts` after regex changes.

## How it is tested

`web/src/lib/f1-safety.test.ts` (limits, 413/429, banned words, no console calls, CSP directives), `web/src/lib/usage.test.ts` (counters in PGlite, fallback), `web/src/lib/health.test.ts` (no env value leaks), `web/src/lib/transcribe.test.ts` (image checks, no storage), `web/src/lib/signals/signals.test.ts` (fabricated quotes dropped).

## Known limits

Limits are per network, so a shared network shares one budget. `'unsafe-inline'` scripts are allowed because the framework requires them (a nonce-based CSP would force dynamic rendering of every page).
