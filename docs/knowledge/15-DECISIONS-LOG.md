# Decisions log

## In plain words

Why ScamLens is built the way it is. Each entry gives the choice, the alternatives considered, the reason and the consequence. Reconstructed from `docs/SPEC.md`, `docs/PROGRESS.md` and the git log; a date is given where the record shows one.

## Details

| Date | Decision | Alternatives | Reason | Consequence |
|---|---|---|---|---|
| M1-M6 (spec) | Three separate tiers; never a single score | One risk score | A score hides why; a wrong "safe" harms people | Every line needs a source; the card is longer |
| M2 (spec) | Identifiers only from our own extractor ("AI proposes, code disposes") | Let the model extract | Models hallucinate addresses; checksums are deterministic | AI can only point at rules and quotes |
| M4 (spec) | AI alone can never produce High | Trust the model | Text patterns are weak evidence | High needs a verified match or reports plus a signal |
| M5 (spec) | Reported only after 2 independent reporters | Show single reports | One person could smear anyone | Few public reports at launch |
| M5 (spec) | Hub filter in graph queries | Link everything | Exchanges would link innocent people | Some real links are hidden behind hubs |
| 2026-10-29 (F1) | Fingerprint = HMAC of the IP only | IP + User-Agent | Switching browsers minted new reporters | Shared networks count once |
| 2026-10-29 (F1) | No accounts | Sign-in | Privacy, speed, nothing to steal | Abuse guarded by per-network limits |
| 2026-10-29 (F2) | Daily per-network limits in Supabase with a memory fallback | No limits | Paid APIs and the service must survive abuse | Limits approximate when the store is down |
| 2026-10-29 (F3) | Screenshot reading: the model only transcribes, the user confirms | Model decides from the image | Keeps identifiers and rules deterministic | Needs a vision key (currently off) |
| 2026-10-29 (F6) | ScamSniffer domain list not used | Load 9.1 MB per request | Over the 8 MB serverless budget | Domains are not checked; the card says so |
| 2026-10-30 (finish H3) | Check domains with GoPlus phishing_site | Leave domains unchecked | A live probe answered 1 for a known phishing domain and 0 for controls, no key needed | Up to 5 domains per check; a listing is a Verified match (High); the notice now says only this list is used |
| 2026-10-29 (F6) | Etherscan free-plan chains only | Paid plan | Cost | BNB Chain and Base shown as needing a paid plan |
| 2026-10-29 (G1) | CSP keeps `'unsafe-inline'` scripts | Nonces | Next.js emits inline bootstrap scripts; nonces force dynamic pages | Documented trade-off on /about |
| 2026-10-29 (G2) | Contested reports stay visible and labelled, never count toward High | Hide on contest | Hiding let anyone erase a true report | Moderator review needed |
| 2026-10-29 (G3) | Warning-context hits shown but not counted | Count everything | News and advice texts were false positives | Decoy sentences are a gaming route (hardened in this round) |
| 2026-10-30 (UI round) | Swiss style, 12-column grid, ten colours; grey and tan never carry text | Narrow column | 70% of a wide screen was unused; faint colours fail contrast for text | Style and contrast tests enforce it |
| 2026-10-30 (UI round) | `/api/health` returns the deployed build | Check Vercel by hand | Proves the live site runs the pushed commit | One 7-character public value in health |
| 2026-10-30 (final round) | AI mode permanently off for this deployment; screenshot reading hidden when off | Pay for a key | Owner decision: no paid AI | Suspected tier is rules only; the UI says so |
| 2026-10-30 (final round) | A solicitation in the hit's sentence beats any warning marker; conditional awareness ("If someone says ..., it is a fraud") is a marker; "if you do not pay" is not advice | Leave the G3 rule as it was, or tune to eval case v01 | A decoy word could hide a scam request; v01 showed a general advisory shape the markers missed | v01 is Low; decoys with a request are flagged; tests both ways |
| 2026-10-30 (final round) | Knowledge base with generated blocks and a docs check | Hand-written docs | Docs drift from code | `npm test` fails on stale docs |

## Where in the code

- `docs/SPEC.md`: the original spec and the dated decision sections.
- `docs/PROGRESS.md`: evidence per step.
- `docs/AUDIT.md`: round 1 audit findings.

## How to change it safely

Add a row whenever a decision changes behaviour, with the reason and the consequence, in the same commit as the change.

## How it is tested

Not testable by itself; each decision's behaviour is covered by the tests named in the topic files.

## Known limits

Dates before 2026-10-29 are only known by milestone (M1-M6), not by day.
