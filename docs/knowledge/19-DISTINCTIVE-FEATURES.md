# Distinctive features

## In plain words

Four features that set ScamLens apart from list-only checkers: a coverage ledger that says exactly what was and was not checked; an "I already paid" plan with a complaint draft built in the browser; a signed receipt anyone can verify; and a public pattern library generated from the same rules the engine uses. Each section below says what it does, why it exists and its limits.

## Details

| Feature | Status |
|---|---|
| Coverage ledger ("What was checked") | built (J5a) |
| "I already paid" mode | built (J5b) |
| Signed check receipt and /verify | built (J5c) |
| Pattern library (/patterns) | not built yet |

### 1. Coverage ledger ("What was checked")
- **What:** a section under the risk header listing every source (OFAC SDN list, ScamSniffer open blacklist, GoPlus address security, Etherscan V2, TronGrid, ScamLens community reports, pattern rules, and the AI helper only when it is configured) with what it covers, a status word and a date. Statuses: `checked`, `not applicable`, `unavailable`, `skipped (limit)`, `off`. Then "Not checked" lines derived from the identifiers found: UPI IDs, phone numbers, Telegram handles and emails have no public database (only community reports are used); website domains were not checked against a blocklist; which sources a wallet was not looked up in (for example a TRON wallet is not on ScamSniffer or Etherscan); Etherscan chains not enabled on the current plan.
- **Why:** a list-only tool's silence reads like "safe". The ledger makes the gaps visible, so "nothing found" is never mistaken for "checked everywhere".
- **How it is built:** `buildCoverage(result)` uses only the check result: source rows, their statuses and reasons, list dates (`dataAsOf`), check times and identifier types. Nothing is typed per run; no date is hard-coded (a test checks the source for dates). It never uses the words "clean" or "safe".
- **Limits:** "checked" means the source answered, not that it found nothing; the finding itself is in the Verified tier. What each source covers is a fixed sentence in `web/src/lib/coverage.ts` that must be kept in line with `web/src/lib/verified/index.ts`.

### 2. "I already paid" mode
- **What:** inside "What to do now", an "I already paid" button opens an ordered plan: call 1930 now; tell the bank or UPI app and ask to hold or reverse the payment (note the complaint number); file at cybercrime.gov.in; keep every chat, screenshot, transaction ID, wallet address and phone number; for crypto, note the transaction hash and destination address (an exchange holding it may be able to act, nothing is guaranteed); never pay a "recovery fee" or "tax to withdraw"; tell someone you trust and change passwords if OTPs or logins were shared. It ends with "No step can promise to get your money back. Not legal advice." Optional fields (amount, date and time, payment method, transaction ID) and a "Copy complaint draft" button follow.
- **Why:** people who already paid need the right order of steps fast, and a complaint that lists the identifiers correctly.
- **How it is built:** the fields are React state only. The draft is built in the browser by running the shared extractor (`web/src/lib/identifiers.ts`) on the text that was checked, listing each identifier exactly as the user typed it (`raw`); the chat itself is not copied. The draft starts "DRAFT COMPLAINT - adapt it before sending. This is a draft, not legal advice." If the clipboard is blocked, the draft is shown on the page instead.
- **Limits:** the interaction test runs without a browser DOM (no DOM test library is installed and no dependency may be added): it calls the same functions the buttons call with `fetch` mocked, and a source scan proves the component has no network code; the click-through itself is checked in the browser in J6.

### 3. Signed check receipt and /verify
- **What:** after each successful check the server signs a receipt: `{version, keyId, issuedAt, build, riskLevel, mode (rules-only or rules+AI), tiers (each finding's tier, kind, title, source, asOf, link), notices, coverage, masked identifiers, textDigest}`. The evidence pack shows a 12-character receipt code and offers "Download signed receipt" (a JSON file built in the browser). The page `/verify` takes a pasted receipt and says either "Signature valid: ScamLens produced this receipt at <time> and it has not been altered. It shows what ScamLens reported then, not that the chat was genuine." or that the signature is not valid. An optional field takes the original text, which the server compares with `textDigest`.
- **Why:** a screenshot of a result can be edited; a signed receipt cannot be changed without detection, so a bank, a family member or a cybercrime officer can check what ScamLens actually reported.
- **How it is built:** see `web/src/lib/receipts.ts` (server: key, digest, sign, verify) and `web/src/lib/receipt-format.ts` (shared: schema, canonical JSON, wording). The browser verifies with WebCrypto Ed25519 where supported and falls back to `POST /api/verify-receipt`.
- **Limits:** a valid receipt proves what ScamLens reported, not that the chat or the person is genuine. Rotating the key makes older receipts fail as "wrong key". Browsers without WebCrypto Ed25519 send the receipt (never the text, unless the user adds it) to the server for checking.

## Where in the code

- `web/src/lib/receipts.ts`, `web/src/lib/receipt-format.ts`: receipts.
- `web/src/app/verify/page.tsx`, `web/src/components/VerifyReceipt.tsx`, `web/src/app/api/verify-receipt/route.ts`: verification.
- `web/src/app/.well-known/scamlens-receipt-key.json/route.ts`: the public key.
- `web/src/lib/complaint-draft.ts` and `web/src/components/PaidPlan.tsx`: the plan and the draft.
- `web/src/lib/coverage.ts`: `buildCoverage`.
- `web/src/components/CoverageLedger.tsx`: the section.
- `web/src/components/RiskCard.tsx`: where it sits (after the risk header).

## How to change it safely

Use only the Swiss tokens; keep every feature driven by real run data or by `rules.ts`, never by hand-typed per-run text. When a source is added in `web/src/lib/verified/index.ts`, add it to `SOURCES` in `web/src/lib/coverage.ts` with the identifier types it covers.

## How it is tested

`web/src/lib/coverage.test.ts`: every status renders (checked with the list date, unavailable with its reason, not applicable, skipped by the rate limit); UPI-only, TRON and domain "Not checked" lines; no AI row while AI is off; no "clean"/"safe"; no hard-coded dates.

## Known limits

Browser checks at 375 and 1440 px are recorded in [18-RELEASE-READINESS.md](18-RELEASE-READINESS.md) once J6 runs.
