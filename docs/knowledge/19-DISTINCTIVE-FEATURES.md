# Distinctive features

## In plain words

Four features that set ScamLens apart from list-only checkers: a coverage ledger that says exactly what was and was not checked; an "I already paid" plan with a complaint draft built in the browser; a signed receipt anyone can verify; and a public pattern library generated from the same rules the engine uses. Each section below says what it does, why it exists and its limits.

## Details

| Feature | Status |
|---|---|
| Coverage ledger ("What was checked") | built (J5a) |
| "I already paid" mode | not built yet |
| Signed check receipt and /verify | not built yet |
| Pattern library (/patterns) | not built yet |

### 1. Coverage ledger ("What was checked")
- **What:** a section under the risk header listing every source (OFAC SDN list, ScamSniffer open blacklist, GoPlus address security, Etherscan V2, TronGrid, ScamLens community reports, pattern rules, and the AI helper only when it is configured) with what it covers, a status word and a date. Statuses: `checked`, `not applicable`, `unavailable`, `skipped (limit)`, `off`. Then "Not checked" lines derived from the identifiers found: UPI IDs, phone numbers, Telegram handles and emails have no public database (only community reports are used); website domains were not checked against a blocklist; which sources a wallet was not looked up in (for example a TRON wallet is not on ScamSniffer or Etherscan); Etherscan chains not enabled on the current plan.
- **Why:** a list-only tool's silence reads like "safe". The ledger makes the gaps visible, so "nothing found" is never mistaken for "checked everywhere".
- **How it is built:** `buildCoverage(result)` uses only the check result: source rows, their statuses and reasons, list dates (`dataAsOf`), check times and identifier types. Nothing is typed per run; no date is hard-coded (a test checks the source for dates). It never uses the words "clean" or "safe".
- **Limits:** "checked" means the source answered, not that it found nothing; the finding itself is in the Verified tier. What each source covers is a fixed sentence in `web/src/lib/coverage.ts` that must be kept in line with `web/src/lib/verified/index.ts`.

## Where in the code

- `web/src/lib/coverage.ts`: `buildCoverage`.
- `web/src/components/CoverageLedger.tsx`: the section.
- `web/src/components/RiskCard.tsx`: where it sits (after the risk header).

## How to change it safely

Use only the Swiss tokens; keep every feature driven by real run data or by `rules.ts`, never by hand-typed per-run text. When a source is added in `web/src/lib/verified/index.ts`, add it to `SOURCES` in `web/src/lib/coverage.ts` with the identifier types it covers.

## How it is tested

`web/src/lib/coverage.test.ts`: every status renders (checked with the list date, unavailable with its reason, not applicable, skipped by the rate limit); UPI-only, TRON and domain "Not checked" lines; no AI row while AI is off; no "clean"/"safe"; no hard-coded dates.

## Known limits

Browser checks at 375 and 1440 px are recorded in [18-RELEASE-READINESS.md](18-RELEASE-READINESS.md) once J6 runs.
