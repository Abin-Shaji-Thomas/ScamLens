# Demo and judging

## In plain words

This file holds the demo scripts, the fallbacks if something is slow, and honest answers to the questions judges usually ask. Every number here comes from a recorded run (`docs/PROGRESS.md`, `eval/RESULTS.md`) or from the code. The product is described as it is: crypto-side verification (on-chain facts, sanctions and blocklists) plus a rule-based language check, with an optional AI helper that is built, tested with mocks, and switched off.

## Details

### 90-second demo (strings and levels from the 2026-10-30 release gate)
1. (10 s) Open <URL>. "Paste a suspicious chat; ScamLens shows what is verified, what is reported and what is only suspected, each with its source."
2. (25 s) Press "1. "Digital arrest" call", then CHECK. Point at the large **High** (3 of 3 meter segments) and the Suspected quotes "Mumbai Police", "digital arrest", "Stay on the video call", "within 2 hours". Point at "zz***d@okdemo was reported by 3 independent people" with its "Illustrative demo data" label.
3. (15 s) Scroll to "What was checked": OFAC, ScamSniffer, GoPlus, Etherscan and TronGrid are "not applicable" for a UPI ID, community reports "checked", and "UPI IDs have no public database here; only community reports are used." "It tells you what it could not check."
4. (15 s) Sample 2: the Verified row "Match · OFAC SDN list" with the list date (High). Sample 3: **Low signals** with "This does not mean safe".
5. (15 s) In "What to do now", press I ALREADY PAID: step 1 "Call 1930 (the National Cyber Crime Helpline) now." Close: "Evidence, not verdicts. Not legal advice."

### 4-minute demo
Add to the 90-second version:
- "Show links for upi zzdemo.refund@": the graph and the Q1 path text; the note under it says which backend answered (Postgres while the TigerGraph workspace is suspended).
- In "I already paid", fill Amount and Transaction ID and press COPY COMPLAINT DRAFT: the draft starts "DRAFT COMPLAINT - adapt it before sending. This is a draft, not legal advice." and lists the identifiers as typed. "Nothing is sent to ScamLens."
- In the evidence pack, press "Download signed receipt", open /verify, paste it, press VERIFY: "Signature valid: ScamLens produced this receipt at ... and it has not been altered. It shows what ScamLens reported then, not that the chat was genuine." Change one letter and verify again: "Signature not valid...".
- Open a Suspected finding's "about this pattern" link: the /patterns entry with what it looks like, why, what to do, an illustrative example and when it is not a signal.
- /about: sources and dates, what is stored, and "AI assistance is optional and currently off."
### Fallbacks
| Problem | Do this |
|---|---|
| TigerGraph asleep | Say so; the graph answers from Postgres and labels it |
| Etherscan slow | The OFAC match on sample 2 still shows (local list) |
| No network | Use the screenshots in `docs/screens/` (after-sample1-1440.png, after-graph-1440.png, after-report-1440.png, after-print-1440.png) |

### Judge questions (honest answers)
| # | Question | Answer |
|---|---|---|
| 1 | Is it live? | Yes, https://scam-lens-two.vercel.app; `/api/health` shows the deployed commit |
| 2 | Is anyone using it? | Not yet at scale; the live Reported tier is mostly labelled demo data |
| 3 | Where is the AI? | ScamLens is crypto-side verification (on-chain facts, sanctions and blocklists) plus a rule-based language check (<!-- FACT:rule_count -->18<!-- /FACT --> fixed rules). An optional AI helper is built and tested with mocks but switched off; no measured AI benefit is claimed |
| 4 | How accurate is it? | On <!-- FACT:eval_cases -->80<!-- /FACT --> synthetic cases the rules reach precision <!-- FACT:eval_precision -->100.0%<!-- /FACT --> and recall <!-- FACT:eval_recall -->100.0%<!-- /FACT --> with <!-- FACT:eval_fp -->0<!-- /FACT --> false positive; these are our own cases, not real-world accuracy |
| 5 | Can it be wrong? | Yes; that is why it shows sources and quotes and never a verdict |
| 6 | What stops fake reports? | 2 independent networks needed, hashed fingerprints, daily caps |
| 7 | What about the person wrongly reported? | They can contest; the entry stays labelled and stops counting toward High until reviewed |
| 8 | Do you store chats? | No; only hashes and masked identifiers for submitted reports |
| 9 | What is crypto-specific? | Checksum-validated wallets, OFAC and ScamSniffer lists, GoPlus flags, on-chain facts on <!-- FACT:free_chains -->Ethereum, Polygon, Arbitrum One<!-- /FACT -->, TRON facts, payment-path graph queries |
| 10 | Why TigerGraph? | Multi-hop links across reports (UPI -> wallet -> Telegram); Postgres fallback with a parity check |
| 11 | What about UPI? | No public database exists; UPI is report-only and never shown as verified |
| 12 | How do you stop abuse? | Per-network daily limits, size caps, strict CSP, no accounts to steal |
| 13 | What if a source is down? | That row says unavailable and the result is marked incomplete; never "clean" |
| 13b | How can anyone trust a screenshot of a result? | They do not have to: every check offers a signed receipt that /verify checks against the published key |
| 14 | What next? | See [16-KNOWN-GAPS-AND-ROADMAP.md](16-KNOWN-GAPS-AND-ROADMAP.md) |

### Claims-to-evidence matrix
| Claim | Evidence |
|---|---|
| Three tiers never mixed | `web/src/lib/check.ts`, render tests in `web/src/lib/ui.test.ts` |
| AI alone never gives High | `web/src/lib/risk.test.ts` |
| 2 independent reporters | `web/db/schema.sql` `having count(distinct ...) >= 2`, test in `web/src/lib/f1-safety.test.ts` |
| No chats stored | `web/src/lib/check.ts` (no storage), console test in `web/src/lib/f1-safety.test.ts` |
| Sources fail safe | `web/src/lib/verified/verified.test.ts` |
| Eval numbers | `eval/RESULTS.md` |
| Receipts cannot be altered | `web/src/lib/receipts.test.ts` (tamper on every field), release-gate /verify run in [18-RELEASE-READINESS.md](18-RELEASE-READINESS.md) |
| "I already paid" sends nothing | `web/src/lib/complaint-draft.test.ts`; release gate: 0 requests |
| Security headers | `npx tsx scripts/check-headers.ts` output in `docs/PROGRESS.md` |

## Where in the code

- `web/src/lib/samples.ts`: the three samples.
- `docs/screens/`: backup screenshots.
- `eval/RESULTS.md`: eval numbers.

## How to change it safely

Quote only numbers wrapped in FACT markers or taken from a recorded run, and update this file when samples or wording change.

## How it is tested

`npm run docs:check` verifies every FACT number against its source.

## Known limits

The demo relies on seeded, labelled demo reports; real reports are few at launch.
