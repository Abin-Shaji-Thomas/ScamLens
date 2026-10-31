# Problem and solution

## In plain words

Scams in India move fast and change shape: "digital arrest" video calls, fake KYC messages, task-and-earn jobs, crypto "investments" that need a fee before you can withdraw. People asking "is this a scam?" usually get either a yes/no verdict nobody can check, or a list lookup that only knows addresses someone already flagged. ScamLens shows *evidence*, split into what is proven, what others reported and what is only suspected, with a source for every line, and never calls anyone a scammer.

## Details

### The problem
- A victim sees only their own chat. The same UPI ID, wallet or handle may have been used on many people, but nobody connects the pieces.
- Most tools give a single score. A score hides *why*, and a wrong "safe" is worse than no answer.
- UPI IDs, phone numbers and Telegram handles have no public verified database at all.
- Money moves within minutes; people need clear next steps (1930, the bank, cybercrime.gov.in), not a lecture.

### The solution: three tiers that are never mixed
| Tier | Where it comes from | Shown when | Example line |
|---|---|---|---|
| Verified | Sources ScamLens queries itself: OFAC SDN list, ScamSniffer blacklist, GoPlus, Etherscan V2, TronGrid | Always (with "unavailable" if a source fails) | "Match · OFAC SDN list" with list date and a link |
| Reported | ScamLens's own community reports | Only after <!-- FACT:min_reporters -->2<!-- /FACT --> independent reporters within <!-- FACT:report_retention_days -->90<!-- /FACT --> days | "zz***d@okdemo was reported by 3 independent people" |
| Suspected | <!-- FACT:rule_count -->19<!-- /FACT --> fixed pattern rules run on the user's own text | Always | "digital arrest" quoted from the text, rule `digital_arrest` |

The risk level (Low signals / Elevated / High) is computed by fixed code. Suspected signals alone can never produce High.

### Principles that must never change
- AI proposes, code disposes: identifiers come only from `web/src/lib/identifiers.ts`; any AI output is validated (known rule id, exact quote) or dropped. The optional AI helper is built and tested with mocks but switched off in this deployment, so the Suspected tier is fixed pattern rules only.
- Never call anyone a scammer (banned-list: scammer, fraudster, criminal, guilty, confirmed scam are banned in user-facing text, test-enforced).
- "No known reports. This does not mean safe." is always shown when the reports database has nothing.
- Your check is never stored. If you choose to contribute a case, we store structured facts and, only if you tick it, a redacted excerpt you reviewed, visible only to the moderator, deleted with your delete code or after 90 days. Transcripts, quotes and screenshots are never stored or logged.
- A source that fails is shown as unavailable and never counted as clean.
- Synthetic data is labelled "Illustrative demo data".

### What ScamLens is NOT
- Not a verdict about a person, not legal or financial advice, not a complete scam database.
- Not a recovery service; it cannot reverse payments.
- Not a scam-baiting tool (it never contacts or tricks anyone).

### How it differs from other kinds of tools (as of 2026-10-30, verify before presenting)
These descriptions use only what this repo's docs already say about the sources it integrates:
- **List-only address checks** (ScamSniffer's open list, GoPlus-style address security APIs, sanctions lists) answer "is this address on our list?". ScamLens uses them as inputs to its Verified tier, but adds the user's own text (Suspected), community reports with an independence rule (Reported), link-graph queries across reports, and identifiers that no address list covers (UPI IDs, Indian phone numbers, Telegram handles).
- **Community report sites** typically show any single report. ScamLens shows a report only after independent reporters agree, masks identifiers, stores only hashes, keeps contested entries visible but labelled, and never lets reports alone be phrased as an accusation.
- ScamLens's distinctive additions in this round: a coverage ledger that says exactly what was and was not checked, an "I already paid" plan, a signed receipt anyone can verify, and a public pattern library (see [19-DISTINCTIVE-FEATURES.md](19-DISTINCTIVE-FEATURES.md)).

## Where in the code

- `web/src/lib/tiers.ts`: tier names and explanations.
- `web/src/lib/risk.ts`: the risk rules.
- `web/src/lib/check.ts`: how the tiers are filled.
- `docs/SPEC.md`: the original specification and every later decision.

## How to change it safely

Any change that mixes tiers, lets text alone reach High, or phrases evidence as a verdict breaks the product's promise. Check `web/src/lib/risk.test.ts` and the banned-words test in `web/src/lib/f1-safety.test.ts` before and after.

## How it is tested

Risk branches and the "AI-only never High" invariant in `web/src/lib/risk.test.ts`; banned words over all source files in `web/src/lib/f1-safety.test.ts`; render tests for each tier in `web/src/lib/ui.test.ts`.

## Known limits

Reports are few at launch (the live Reported tier holds mostly labelled demo data). UPI, phone and Telegram identifiers can only ever be Reported or Suspected, never Verified.
