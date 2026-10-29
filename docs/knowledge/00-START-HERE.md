# Start here

## In plain words

ScamLens is a free web page for people in India who received a suspicious message. You paste the chat (or just a wallet address, UPI ID, phone number or Telegram handle) and press Check. ScamLens shows what it could find, sorted into three groups that are never mixed: **Verified** (facts it checked itself, each with a source link), **Reported** (other people's reports, shown only once at least <!-- FACT:min_reporters -->2<!-- /FACT --> independent people reported the same identifier) and **Suspected** (warning-sign phrases found in your own text by fixed rules, each with the exact quote). It never says a person is guilty of anything; it shows evidence and what to do next.

Live site: https://scam-lens-two.vercel.app (team ArcReap, built for Hacker House Goa 2026, Crypto x AI track).

## Details

### Who it helps
- Someone who got a "digital arrest" video call, a "KYC expired" SMS, a crypto "investment" pitch or a "pay a fee to withdraw" message and wants a second opinion before paying.
- Family members helping an older relative decide whether a message is a known pattern.
- People who already paid and need the right next steps quickly (call 1930, tell the bank, file at cybercrime.gov.in).

### A worked example (sample 1, the "digital arrest" call; real output from the 2026-10-30 browser run)

Input (synthetic, labelled "Illustrative demo data"):
> This is Inspector Rao from Mumbai Police cyber cell. A courier package in your name with MDMA was seized. You are under digital arrest. Stay on the video call and do not tell your family. Transfer your savings to our RBI verification account within 2 hours: zzdemo.refund@okdemo

What happens:
1. **Identifiers.** The extractor finds one UPI ID, `zzdemo.refund@okdemo` (format valid). The AI never finds identifiers; only `web/src/lib/identifiers.ts` does.
2. **Verified.** UPI IDs have no public database, so nothing is verified for it. The card says "No verified matches. Sources that fail are shown as unavailable, never as safe."
3. **Reported.** The seeded demo database holds reports for this UPI ID from 3 different networks, so the card shows "zz***d@okdemo was reported by 3 independent people" (masked) with the demo label.
4. **Suspected.** Fixed rules quote the exact words: "Mumbai Police" (authority impersonation), "courier package in your name with MDMA was seized", "digital arrest", "Stay on the video call" (digital-arrest threat) and "within 2 hours" (urgency).
5. **Risk.** A reported identifier plus at least one suspected signal gives **High**. The meter shows 3 of 3 segments, and the reasons list says "1 identifier(s) reported by 2+ independent people", "3 suspected pattern(s) in the text" and "1 source(s) unavailable - result is incomplete" (the optional AI helper is switched off, so it counts as unavailable).
6. **What to do now.** Pause, verify through an official channel, keep evidence, call 1930 or file at cybercrime.gov.in, contact the bank if money was sent.

### Glossary

| Term | Meaning |
|---|---|
| Identifier | Something that names a person or account: wallet address, UPI ID, phone number, Telegram handle, email, website domain |
| UPI | Unified Payments Interface, India's instant bank-transfer system; a UPI ID looks like `name@bank` |
| EVM | Ethereum Virtual Machine; wallets on Ethereum, Polygon, Arbitrum and similar chains share the `0x...` format |
| TRON | A blockchain popular for USDT transfers; addresses start with `T` |
| BTC | Bitcoin; legacy (`1...`, `3...`) and bech32 (`bc1...`) addresses |
| Checksum | Built-in error detection in an address (EIP-55 for EVM, Base58Check for TRON/BTC); a typo fails it |
| EIP-55 | The mixed-case checksum rule for EVM addresses |
| Base58Check | An encoding with a 4-byte checksum, used by TRON and legacy BTC |
| Bech32 | The `bc1...` Bitcoin address format with its own checksum |
| Tier | One of the three evidence groups: Verified, Reported, Suspected |
| Verified tier | Facts ScamLens checked itself against a named source |
| Reported tier | Community reports, shown only after independent reporters agree |
| Suspected tier | Warning-sign phrases found in the user's own text by fixed rules |
| Signal | One rule hit: a rule id, a label and an exact quote |
| Rule | A fixed list of text patterns for one scam tactic, in `rules.ts` |
| Quote | The exact characters from the user's text that a rule matched |
| Warning context | A sentence that warns about scams ("never share your OTP"); hits there are shown but not counted |
| Risk level | Low signals, Elevated or High, computed by fixed code from the tiers |
| OFAC | US Treasury Office of Foreign Assets Control; publishes the SDN sanctions list |
| SDN list | Specially Designated Nationals list; includes some crypto addresses |
| ScamSniffer | An open-source blacklist of scam-linked crypto addresses (public copy about 7 days delayed) |
| GoPlus | A public address-security API that flags risky addresses |
| Etherscan V2 | One API for on-chain facts on several EVM chains |
| TronGrid | The TRON network API used for account facts |
| On-chain facts | Balance, first and last transaction, contract or not; facts, not judgements |
| Fingerprint | A keyed hash of the reporter's IP address; the IP itself is never stored |
| HMAC | A hash that needs a secret key, so stored values are useless without it |
| Pepper | The secret key (`REPORT_HASH_PEPPER`) used for those HMACs |
| Masking | Hiding most of an identifier for display, e.g. `zz***d@okdemo` |
| Independent reporters | Reports from different fingerprints; one network counts once |
| Contest | A request by the owner of an identifier to review a report about it |
| Contested | Label on a report under review; it stays visible but never counts toward High |
| Graph | A network of identifiers linked through reports and payments |
| TigerGraph | The graph database used for link queries |
| GSQL | TigerGraph's query language |
| Hub filter | Rule that never links people through exchanges or very busy addresses |
| Postgres fallback | The same graph queries written in SQL, used when TigerGraph is unavailable |
| Supabase | Hosted Postgres that stores reports, graph edges and usage counters |
| Service role | The Supabase key used only on the server; the browser never gets it |
| PGlite | Postgres compiled to WebAssembly; runs the real SQL inside tests |
| Abuse guard | Daily per-network limits that stop one person from exhausting the service |
| CSP | Content Security Policy; browser rules about where a page may load code from |
| ReDoS | Regular-expression denial of service: a pattern that takes very long on crafted input |
| Evidence pack | Plain-text summary of a result to copy, print or attach to a complaint |
| Notice | A "Note: ..." line saying something could not be checked |
| Unavailable | A source that failed or timed out; never treated as a clean result |
| Synthetic / demo data | Invented data used for samples, always labelled "Illustrative demo data" |
| Eval | The offline test of the rules on hand-labelled synthetic chats |
| Precision / recall | Of the flagged chats, how many were scams / of the scams, how many were flagged |
| False positive | A normal message wrongly flagged |
| Receipt | A signed record of what ScamLens reported for a check (see 19) |
| Ed25519 | The digital-signature algorithm used for receipts |
| 1930 | India's National Cyber Crime Helpline number |

## Where in the code

- `web/src/app/page.tsx`: the home page.
- `web/src/lib/check.ts`: the whole check pipeline in one function.
- `web/src/lib/identifiers.ts`: the identifier extractor.
- `web/src/lib/samples.ts`: the three built-in samples.

## How to change it safely

Read [02-HOW-IT-WORKS.md](02-HOW-IT-WORKS.md) and [07-RISK-ENGINE.md](07-RISK-ENGINE.md) before touching the pipeline. The principles that must never change are listed in [01-PROBLEM-AND-SOLUTION.md](01-PROBLEM-AND-SOLUTION.md).

## How it is tested

`npm test` in `web/` runs every unit, SQL and render test; `npm run eval` runs the synthetic evaluation. See [12-TESTING-AND-EVAL.md](12-TESTING-AND-EVAL.md).

## Known limits

ScamLens is not a complete scam database and never a safety guarantee. "No reports" does not mean safe. See [16-KNOWN-GAPS-AND-ROADMAP.md](16-KNOWN-GAPS-AND-ROADMAP.md).
