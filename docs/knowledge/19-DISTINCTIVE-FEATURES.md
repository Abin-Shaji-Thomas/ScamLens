# Distinctive features

## In plain words

Four features that set ScamLens apart from list-only checkers: a coverage ledger that says exactly what was and was not checked; an "I already paid" plan with a complaint draft built in the browser; a signed receipt anyone can verify; and a public pattern library generated from the same rules the engine uses. Each section below says what it does, why it exists and its limits.

## Details

| Feature | Status |
|---|---|
| Coverage ledger ("What was checked") | built (J5a) |
| "I already paid" mode | built (J5b) |
| Signed check receipt and /verify | built (J5c) |
| Pattern library (/patterns) | built (J5d) |

### 1. Coverage ledger ("What was checked")
- **What:** a section under the risk header listing every source (OFAC SDN list, ScamSniffer open blacklist, GoPlus address security, Etherscan V2, TronGrid, ScamLens community reports, pattern rules, and the AI helper only when it is configured) with what it covers, a status word and a date. Statuses: `checked`, `not applicable`, `unavailable`, `skipped (limit)`, `off`. Then "Not checked" lines derived from the identifiers found: UPI IDs, phone numbers, Telegram handles and emails have no public database (only community reports are used); website domains were not checked against a blocklist; which sources a wallet was not looked up in (for example a TRON wallet is not on ScamSniffer or Etherscan); Etherscan chains not enabled on the current plan.
- **Link graph row** (TigerGraph finish round): on the result card the ledger also lists "Link graph": `not looked up (press Show links)` until a lookup happens, then `checked` with the backend and its time (for example "tigergraph, 412 ms"), `unavailable`, or `not applicable` when there is no UPI ID or EVM wallet to look up. The row comes from the page's own graph lookup; the signed receipt's coverage is built without it and is unchanged.
- **Why:** a list-only tool's silence reads like "safe". The ledger makes the gaps visible, so "nothing found" is never mistaken for "checked everywhere".
- **How it is built:** `buildCoverage(result)` uses only the check result: source rows, their statuses and reasons, list dates (`dataAsOf`), check times and identifier types. Nothing is typed per run; no date is hard-coded (a test checks the source for dates). It never uses the words "clean" or "safe".
- **Why? links** (finish round): each `not applicable` row and the Not checked list end with a "Why?" link to `/about#sources`, which says what each source covers.
- **Limits:** "checked" means the source answered, not that it found nothing; the finding itself is in the Verified tier. What each source covers is a fixed sentence in `web/src/lib/coverage.ts` that must be kept in line with `web/src/lib/verified/index.ts`.

### 1b. Linked-identifier hints (TigerGraph finish round)
- **What:** under the Reported entries, "This UPI ID is linked to N other identifiers in community reports. Show links to see how." for up to 3 reported identifiers that have links in the graph, with "A link is not proof of wrongdoing." and the demo label when synthetic.
- **Why:** the graph's value is visible without pressing anything, while the card itself never waits for it.
- **Limits:** background lookups use the daily graph limit; failures and limits show nothing, so absence of a hint is not evidence either way.

### 2. "I already paid" mode
- **What:** inside "What to do now", an "I already paid" button opens an ordered plan: call 1930 now; tell the bank or UPI app and ask to hold or reverse the payment (note the complaint number); file at cybercrime.gov.in; keep every chat, screenshot, transaction ID, wallet address and phone number; for crypto, note the transaction hash and destination address (an exchange holding it may be able to act, nothing is guaranteed); never pay a "recovery fee" or "tax to withdraw"; tell someone you trust and change passwords if OTPs or logins were shared. It ends with "No step can promise to get your money back. Not legal advice." Optional fields (amount, date and time, payment method, transaction ID) and a "Copy complaint draft" button follow.
- **Why:** people who already paid need the right order of steps fast, and a complaint that lists the identifiers correctly.
- **How it is built:** the fields are React state only. The draft is built in the browser by running the shared extractor (`web/src/lib/identifiers.ts`) on the text that was checked, listing each identifier exactly as the user typed it (`raw`); the chat itself is not copied. The draft starts "DRAFT COMPLAINT - adapt it before sending. This is a draft, not legal advice." If the clipboard is blocked, the draft is shown on the page instead.
- **Limits:** the interaction test runs without a browser DOM (no DOM test library is installed and no dependency may be added): it calls the same functions the buttons call with `fetch` mocked, and a source scan proves the component has no network code; the click-through itself is checked in the browser in J6.

### 3. Signed check receipt and /verify
- **What:** after each successful check the server signs a receipt: `{version, keyId, issuedAt, build, riskLevel, mode (rules-only or rules+AI), tiers (each finding's tier, kind, title, source, asOf, link), notices, coverage, masked identifiers, textDigest}`. Under the evidence pack a labelled step "Share proof" (finish round) says "Download the signed receipt and send it to your bank, a family member or the cybercrime portal. Anyone can check at Verify that it was not edited.", with "Download signed receipt" (a JSON file built in the browser), an "Open Verify" link and the 12-character receipt code; the step is absent when the check returned no receipt. The page `/verify` takes a pasted receipt and says either "Signature valid: ScamLens produced this receipt at <time> and it has not been altered. It shows what ScamLens reported then, not that the chat was genuine." or that the signature is not valid. An optional field takes the original text, which the server compares with `textDigest`.
- **Why:** a screenshot of a result can be edited; a signed receipt cannot be changed without detection, so a bank, a family member or a cybercrime officer can check what ScamLens actually reported.
- **How it is built:** see `web/src/lib/receipts.ts` (server: key, digest, sign, verify) and `web/src/lib/receipt-format.ts` (shared: schema, canonical JSON, wording). The browser verifies with WebCrypto Ed25519 where supported and falls back to `POST /api/verify-receipt`.
- **Limits:** a valid receipt proves what ScamLens reported, not that the chat or the person is genuine. Rotating the key makes older receipts fail as "wrong key". Browsers without WebCrypto Ed25519 send the receipt (never the text, unless the user adds it) to the server for checking.

### 4. Pattern library (/patterns)
- **What:** a static page that explains each of the <!-- FACT:rule_count -->18<!-- /FACT --> rules: a plain name, what it looks like, why such messages use it, what to do, an "Illustrative example", when it is not a signal, and how it counts. The intro says "These are patterns, not verdicts." Every Suspected finding links to its rule's anchor (`/patterns#<rule id>`), and the header and footer link to the page. A "Check a message" button sits under the intro, and each example has a "Try this example" link to `/?example=<rule id>` (finish round): the home page accepts only a rule id that exists in `rules.ts` and `pattern-guide.ts`, fills the box with that example, marks it "Example from the pattern library: <name>. Edit it or press Check." plus the demo label, and waits for Check; any other value gives an empty box.
- **Why:** people learn the tactics, not just one result, and can see exactly why a phrase was flagged and when it would not be.
- **How it is built:** the rule list, order and guards come from `web/src/lib/signals/rules.ts` (the same source as the engine); "When it is not a signal" is generated from each rule's guards (negation, corroboration) plus the warning-context rule; `web/src/lib/signals/pattern-guide.ts` adds only the plain-language text, keyed by rule id.
- **Limits:** the explanations are hand-written; a test makes sure every rule has one and that each example really triggers its own rule, but it cannot judge the wording.

## Where in the code

- `web/src/app/patterns/page.tsx`, `web/src/lib/signals/pattern-guide.ts`: the pattern library.
- `web/src/lib/pattern-example.ts`: `patternExample` (validates `?example=`) and `exampleHref`.
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

`web/src/lib/coverage.test.ts`: every status renders (checked with the list date, unavailable with its reason, not applicable, skipped by the rate limit); UPI-only, TRON and domain "Not checked" lines; no AI row while AI is off; no "clean"/"safe"; no hard-coded dates; "Why?" links on every not-applicable row and under Not checked, none on checked rows. `web/src/lib/pattern-example.test.ts`: every rule id is accepted with its own example; missing, repeated, unknown and inherited keys (`constructor`, `__proto__`) are rejected; the home page pre-fills and labels a valid example without running the check and stays empty otherwise; /patterns has "Check a message" and one "Try this example" link per rule. `web/src/lib/receipts.test.ts`: the Share proof step renders with a receipt (sentence, button, /verify link, code) and is absent without one.

## Known limits

All four were checked in the browser at 375 and 1440 px on 2026-10-30; results in [18-RELEASE-READINESS.md](18-RELEASE-READINESS.md). The clipboard copy itself is UNKNOWN (headless Edge blocks the clipboard; the on-page fallback worked).
