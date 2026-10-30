# How it works

## In plain words

When you press Check, the browser sends your text to one server function. That function finds identifiers with its own code, then runs three things at the same time: the Verified sources, the pattern rules, and the reports lookup. A fixed rule turns those results into a risk level. Nothing is stored; the answer goes back to your browser and the text is forgotten.

## Details

```
 browser                     server: POST /api/check (web/src/app/api/check/route.ts)
 -------                     ------------------------------------------------------------
 text  ----------------->    1. size cap (413) and zod validation (400), plain messages, input never echoed
                             2. abuse guard: daily count per network fingerprint (429 + Retry-After)
                             3. runCheck(text)                         web/src/lib/check.ts
                                a. extractIdentifiers(text)            web/src/lib/identifiers.ts
                                   -> unique, first 20 kept (notice if more)
                                b. in parallel:
                                   - runVerifiedChecks(addresses)      web/src/lib/verified/index.ts
                                       OFAC, ScamSniffer, GoPlus, Etherscan (EVM), TronGrid (TRON)
                                       every failure -> "unavailable"
                                   - detectSignals(text)               web/src/lib/signals/index.ts
                                       fixed rules on a de-obfuscated copy, quotes cut from the original
                                       warning-context marking; optional AI pass (off here)
                                   - reportedFor(identifiers)          web/src/lib/reports/service.ts
                                       SQL counts distinct fingerprints within 90 days
                                c. assessRisk(...)                     web/src/lib/risk.ts
 card  <-----------------    4. JSON response (CheckResponse schema, web/src/lib/api-schema.ts)
```

**Scam trail (final round P5).** Next to the sources, the rules and the reports, every check runs `runScamTrail` (`web/src/lib/trail/trail.ts`) with a hard 2.5 s deadline: up to 5 identifiers of graph types (wallets first), 3 at a time, each with its 2-step neighbourhood (Q4) from TigerGraph, or from the Postgres copy labelled `postgres (TigerGraph unavailable)` when TigerGraph fails. For each identifier it counts linked identifiers, how many of those are reported by 2+ independent people, the most reporters behind one of them, and whether the cluster reaches a flagged address; for the whole trail it adds case counts by category, channel, loss band and month (`case_trail_cluster`, migration 004) or, before 004, counts from the reports. Synthetic and real counts are kept apart. A failure or the deadline gives status `unavailable` and the notice "The scam trail (links to other reported identifiers) could not be checked this time, so it is missing from this result.", never a clean result; without a graph database the trail is `off` (no notice).

### Step by step, with sample 2 (crypto "investment" with a sanctioned wallet)
1. **Validate.** The body is at most <!-- FACT:max_text_chars -->6,000<!-- /FACT --> characters of text; larger requests get a friendly 413 without the text being echoed.
2. **Guard.** The network fingerprint (keyed hash of the IP) may run <!-- FACT:checks_per_day -->40<!-- /FACT --> checks per day by default; over the limit the server answers 429 before calling any external source.
3. **Extract.** The extractor finds the `0x...` wallet and confirms its EIP-55 checksum. A string that looks like an address but fails the checksum is not treated as one.
4. **Verified.** For an EVM wallet: the OFAC list (a local snapshot), the ScamSniffer list (local snapshot), GoPlus (live API), and Etherscan on each enabled chain (<!-- FACT:free_chains -->Ethereum, Polygon, Arbitrum One<!-- /FACT --> on the free plan). The sample wallet is on the OFAC list, so the row reads "Match · OFAC SDN list" with the list date.
5. **Suspected.** Rules quote phrases like guaranteed returns or a withdrawal fee. Each quote is cut from the original text by offsets.
6. **Reported.** Hashes of the identifiers are looked up; nothing is shown unless independent reporters agree.
7. **Risk.** One verified match is enough for **High** (measured on 2026-10-30: sample 2 = High, 3 of 3 meter segments).
8. **Card.** The browser shows the risk header, the three tiers, the link graph buttons, "What to do now" and the evidence pack.

### What the browser does on its own
- Samples, the evidence pack and printing are built in the browser from the response.
- "Show links" calls `POST /api/graph` for one identifier at a time.
- "Report these identifiers" calls `POST /api/report` only when the user submits the form with consent.

## Where in the code

- `web/src/app/api/check/route.ts`: the route.
- `web/src/lib/body.ts`: size caps before JSON parsing.
- `web/src/lib/check.ts`: `runCheck`.
- `web/src/lib/identifiers.ts` and `web/src/lib/extract/`: the extractor.
- `web/src/lib/verified/index.ts`: which sources run for which identifier type.
- `web/src/lib/signals/index.ts`: rules, warning context, optional AI.
- `web/src/lib/reports/service.ts`: reports lookup.
- `web/src/lib/risk.ts`: the level.
- `web/src/components/CheckForm.tsx` and `web/src/components/RiskCard.tsx`: the page.

## How to change it safely

Keep `runCheck` free of storage and logging. New sources go into `tasksFor` in `web/src/lib/verified/index.ts` and must turn every error into `unavailable`. Run `npm test` and `npm run eval`.

## How it is tested

`web/src/lib/verified/verified.test.ts` (mocked sources, timeouts become unavailable), `web/src/lib/signals/signals.test.ts`, `web/src/lib/risk.test.ts`, `web/src/lib/f1-safety.test.ts` (limits, 413/429), and the live script `web/scripts/smoke-live.ts` (all three samples end to end).

## Known limits

Only the first wallet gets Etherscan history (rate limit). Website domains (up to 5) are checked against GoPlus's phishing-site list only. The whole check can take several seconds when Etherscan queues requests.
