# Demo and judging

## In plain words

This file holds the demo scripts, the fallbacks if something is slow, and honest answers to the questions judges usually ask. Every number here comes from a recorded run (`docs/PROGRESS.md`, `eval/RESULTS.md`) or from the code. The product is described as it is: crypto-side verification (on-chain facts, sanctions and blocklists) plus a rule-based language check, with an optional AI helper that is built, tested with mocks, and switched off.

## Details

### 90-second demo
1. (10 s) Open https://scam-lens-two.vercel.app. "Paste a suspicious chat; ScamLens shows what is verified, what is reported and what is only suspected, each with its source."
2. (25 s) Press sample 1, "Digital arrest" call, then Check. Point at **High**, the 3-segment meter, and the Suspected quotes ("Mumbai Police", "digital arrest", "Stay on the video call"). Point at the Reported line "zz***d@okdemo was reported by 3 independent people" and its "Illustrative demo data" label.
3. (25 s) Sample 2, sanctioned wallet: the Verified row "Match · OFAC SDN list" with the list date and a link. "This is a fact we checked, not a guess."
4. (15 s) Sample 3, genuine-looking bank alert: **Low signals** with "This does not mean safe". "We never say safe."
5. (15 s) "What to do now" band: 1930, the bank, cybercrime.gov.in. Close: "Evidence, not verdicts."

### 4-minute demo
Add to the 90-second version: "Show links" on sample 1 (the link graph and the Q1 path text; the note says which backend answered), the evidence pack Preview, the /about trust page (sources, dates, what is stored), and the privacy rules (hashes only, 2 independent reporters, contested entries stay labelled). The distinctive features of this round are added in step J7 from the real runs.

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
| 3 | Where is the AI? | An optional AI helper is built and tested with mocks but switched off; the Suspected tier uses <!-- FACT:rule_count -->18<!-- /FACT --> fixed rules. No measured AI benefit is claimed |
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
