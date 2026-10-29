# ScamLens

**Evidence-linked scam check for India.** Paste a suspicious chat, wallet address, UPI ID or Telegram handle, or read the text from a screenshot and confirm it. ScamLens returns a risk card that keeps three kinds of evidence strictly apart, each with its source, and never gives a verdict about a person.

**Live:** https://scam-lens-two.vercel.app · Hacker House Goa 2026 (Crypto x AI track, team ArcReap) · [About, sources and privacy](https://scam-lens-two.vercel.app/about)

## The problem

Indian users meet "digital arrest" calls, task-and-earn jobs, fake KYC and refund links, and crypto "investment" groups every day. The usual answer is either a generic warning or a black-box "scam / not scam" score. Neither shows *why*, neither separates what is a checked fact from what someone claimed, and a wrong verdict harms the person who was labelled.

## The solution

One paste box, one risk card, three tiers that are never mixed:

| Tier | What it means | Where it comes from |
|---|---|---|
| **1. Verified** | Facts we check ourselves, each with source, date and a link to check it yourself | OFAC SDN list, ScamSniffer open address list, GoPlus address security, Etherscan V2 (Ethereum, Polygon, Arbitrum One on the free plan), TronGrid |
| **2. Reported** | Community reports, shown only after **2 independent reporters** within 90 days and not contested | ScamLens' own database (HMAC hashes + masked identifiers only) |
| **3. Suspected** | Warning patterns in *your* text, each with the exact highlighted quote and the rule that fired | 18 fixed rules, plus an optional LLM pass whose output is validated by code |

Every card also shows a plain-language explanation of the risk level and a **What to do now** block (pause; verify through official channels; keep the chat and transaction IDs; call **1930** or file at **cybercrime.gov.in**; contact your bank immediately if you already paid).

### How the risk level is decided

- **High signals**: at least one Verified match, **or** an identifier reported by 2+ independent reporters **and** at least one Suspected signal.
- **Elevated signals**: Suspected signals or reports that do not meet the High rule. **AI or pattern signals alone can never produce High.**
- **Low signals - not a safety guarantee**: nothing found. The card always says *"No known reports. This does not mean safe."*, or that the reports database is unavailable.
- **Failure rule**: a source that errors or times out is shown as **unavailable**, never as clean. There is no "safe" status in the code.

### Trust anchors

- **AI proposes, code disposes.** Identifiers come only from our extractor (`web/src/lib/identifiers.ts`: EIP-55, Base58Check with version bytes, bech32/bech32m, strict UPI/+91/Telegram/email/domain formats). The LLM may only return `{rule_id, quote}`; unknown rule ids and quotes that are not exact substrings of the input are dropped. A screenshot is only transcribed; the user edits and confirms the text, and that text goes through the same extractor and rules.
- **No raw chats stored or logged.** Checks run in memory. The logger accepts only an event name, a status and a duration (tested). Reports store a peppered HMAC of each identifier, a masked display (e.g. `zz***d@okdemo`), the scam type and a hashed network fingerprint.
- **Wording.** "Reported", "linked", "matched list X on date Y". A test scans all source files for accusatory words.

## Architecture

```
 browser (Next.js page, client components)
   | paste text            | screenshot -> downscaled JPEG in the browser
   v                       v
 POST /api/check        POST /api/transcribe ---> vision LLM (transcribe only) ---> editable text ---+
   |                                                                                                |
   | zod limits (6,000 chars, 20 identifiers) -> usage guard (per-network daily caps, global LLM cap)
   v                                                                                                |
 extractor (identifiers.ts) ---------------------------------------------------------------<--------+
   |
   +--> Verified:  OFAC + ScamSniffer snapshots (web/data) | GoPlus | Etherscan V2 (<=2 chains in flight) | TronGrid
   +--> Reported:  Supabase Postgres  reported_counts()  (>= 2 distinct fingerprints, 90 days, not contested)
   +--> Suspected: 18 regex rules on a de-obfuscated copy (quotes mapped back) + optional LLM -> validator
   v
 risk rules (risk.ts) -> risk card + notices + evidence pack (copy / print)

 POST /api/graph  -> TigerGraph Savanna (Q1-Q4 over REST)  --fallback-->  Postgres recursive CTEs (same answers)
 POST /api/report -> submit_report() in SQL (rate limit, one fingerprint per identifier) -> mirrored to TigerGraph
 GET  /api/health -> booleans / short statuses only
```

```
web/                        Next.js 16 app (Vercel root directory)
  src/app/                  page, /about, API routes (check, transcribe, graph, report, report/contest, health)
  src/lib/identifiers.ts    extractor + validation
  src/lib/verified/         OFAC, ScamSniffer, GoPlus, Etherscan V2, TronGrid
  src/lib/signals/          18 rules, normaliser, regex pass, validated LLM pass
  src/lib/usage.ts          abuse guard (Supabase counters, memory fallback)
  src/lib/transcribe.ts     screenshot -> text
  src/lib/reports/          hashing, masking, 2-reporter rule, contest
  src/lib/graph/            findLinks: TigerGraph REST or Postgres recursive CTE
  db/schema.sql             tables + SQL functions (Supabase or local PGlite)
  data/                     OFAC + ScamSniffer snapshots (scripts/sync-lists.ts)
  scripts/                  sync-lists, smoke-verified, smoke-transcribe, smoke-live, probe-etherscan-chains, graph-demo, tg-setup, redos-check
graph/                      TigerGraph schema, migrations, GSQL queries Q1-Q4 (see graph/README.md)
eval/                       synthetic labelled chats, scorer, RESULTS.md
docs/                       SPEC, AUDIT, PROGRESS, HUMAN_TASKS, DEPLOY, CHAIN_SUPPORT, UI_CHECKLIST
```

**Link graph (TigerGraph).** Q1 UPI -> wallet -> Telegram linked only through a shared wallet, with the two halves from two different reporters; Q2 wallet -> up to 2 payment hops -> flagged address; Q3 different Telegram handles reported with the same wallet by at least 2 different reporters; Q4 neighbourhood for the graph view. A hub filter drops nodes with more than `GRAPH_HUB_MAX` (default 25) counterparties and any exchange address, so unrelated people are not linked. `scripts/tg-setup.ts` checks that TigerGraph and Postgres give identical answers. Details: [graph/README.md](graph/README.md).

## Data sources and licences

- **OFAC SDN list**: U.S. Treasury (`SDN.XML`), digital-currency address fields. US government work, public domain. Snapshot publish date shown on every row.
- **ScamSniffer scam-database**: [github.com/scamsniffer/scam-database](https://github.com/scamsniffer/scam-database), `blacklist/all.json` address list, GPL-3.0, with attribution. The public copy is about 7 days behind ScamSniffer's live feed; the UI says so. The domain list (9.1 MB when probed on 2026-10-29) is over this deployment's 8 MB budget and is **not** used; checks that contain a domain say so.
- **GoPlus** address security API, **Etherscan V2** API, **TronGrid** API: queried live per check, subject to their terms. Chain coverage measured with a live probe: [docs/CHAIN_SUPPORT.md](docs/CHAIN_SUPPORT.md).
- Helpline **1930** and **cybercrime.gov.in**: Indian Cyber Crime Coordination Centre (I4C), Ministry of Home Affairs.

## Limits

| Limit | Value |
|---|---|
| Text per check | 6,000 characters (413/400 with a plain message above that) |
| Identifiers per check / crypto addresses looked up | 20 / 10 |
| Screenshot | PNG, JPEG or WebP, data URL up to 1,500,000 characters (the browser downscales to 1600 px JPEG first) |
| Daily per network fingerprint | 40 checks, 10 screenshots, 100 link lookups, 3 contests, 5 reports (HTTP 429 with `Retry-After`, no external calls made) |
| Global LLM calls per day | 1,500; above it the AI pass is skipped with a notice and the rules still run |
| Etherscan | first EVM wallet only, at most 2 chains in flight, 2 requests/s |

## Running and testing locally

```powershell
cd web
npm install
copy .env.example .env.local      # fill in what you have; everything is optional for a first run
npm run dev                       # http://localhost:3000
npm run lint; npm run typecheck; npm test; npm run build
npm run eval                      # writes eval/RESULTS.md
npx tsx scripts/sync-lists.ts     # refresh OFAC + ScamSniffer snapshots in web/data
npx tsx scripts/smoke-verified.ts # live check of the verified tier
npx tsx scripts/smoke-live.ts http://localhost:3000   # end-to-end smoke against a running server
npx tsx scripts/graph-demo.ts     # seed synthetic data into local Postgres (PGlite) and run Q1-Q3
npx tsx scripts/redos-check.ts    # time every regex on adversarial 6,000-char inputs
```

Tests use mocked network calls, an in-memory Postgres (PGlite) loaded with `db/schema.sql`, and injected LLM completers; they never call a real API. Deployment, env var names and SQL order: [docs/DEPLOY.md](docs/DEPLOY.md).

## Evaluation (synthetic)

`eval/chats.json` holds 66 **synthetic**, hand-written labelled chats (33 scam, 33 normal). 26 of them were added in F5: 13 scam cases using obfuscation (spaced letters, emoji separators, line breaks, mixed Hindi/English) and 13 deliberately tricky normal ones (a bank OTP alert, a news article about scams, a police awareness message about "digital arrest"). A chat counts as "scam" when the engine finds at least one suspected signal. Numbers below are copied from [eval/RESULTS.md](eval/RESULTS.md), which `cd web && npm run eval` writes (regex-only mode; the AI pass was not run because no key is set):

| metric | value |
|---|---|
| accuracy | 93.9% |
| precision | 89.2% |
| recall | 100.0% |
| false positives | 4 of 33 normal |
| false negatives | 0 of 33 scam |
| identifier extraction precision / recall | 100.0% / 100.0% (6 hand-listed identifiers) |

The 4 false positives in the first 40-case run (a delivery OTP, a college Telegram group, a mutual-fund disclaimer and a family WhatsApp chat) were fixed with narrow guards, each with a regression test (see the header of `web/src/lib/signals/rules.ts`). The 4 that remain are all new tricky cases and were left in on purpose: a news article and a police awareness message that quote scam lines, a housing-society "lucky draw" and a friend saying "guaranteed returns are a red flag".

The same person wrote the rules and the chats, so these numbers are optimistic and are **not** a real-world accuracy claim. RESULTS.md has per-rule precision and recall and a section on what this evaluation is not.

## 90-second demo script

Open the live URL. Each sample is one click under **Try a sample** and is labelled **"Illustrative demo data - not a real investigation"**.

| Time | Do | What appears |
|---|---|---|
| 0:00-0:15 | Say: "ScamLens separates what is checked, what is reported and what is only suspected." | Empty risk card with Tier 1 Verified, Tier 2 Reported, Tier 3 Suspected |
| 0:15-0:40 | **Sample 1 - "Digital arrest" call** -> Check | **High signals**, with no AI involved: the UPI ID has no verified source but is **reported by 3 independent reporters** (synthetic seed, labelled), and the text has *authority impersonation*, *digital arrest* and *urgency* signals with highlighted quotes. "What to do now" lists 1930 and cybercrime.gov.in. Press **Show links for upi ...**: the UPI is linked to Telegram handles only through a shared wallet, marked "Illustrative demo data". |
| 0:40-1:05 | **Sample 2 - Crypto "investment"** -> Check | **High signals.** Verified: the wallet **matched the OFAC SDN list** (publish date + link to the Treasury entry); ScamSniffer and GoPlus rows with their dates and links; Etherscan facts for the free-plan chains, BNB Chain and Base shown as unavailable. Suspected: guaranteed returns, fake profit proof, small amount first, move to Telegram. |
| 1:05-1:20 | **Sample 3 - Bank alert** -> Check | **Low signals - not a safety guarantee.** "Never share your OTP" does not fire the OTP rule (negation guard). |
| 1:20-1:30 | Click **Copy evidence pack** (or **Print or save as PDF**) | Plain-text summary with the three tiers separated, the demo label, and next steps. Not legal advice. Footer -> **/about** for sources, licences and privacy. |

Sample 2 uses a real address from the OFAC SDN list so the Verified tier can be shown live; the chat around it is invented. Replay from a terminal: `cd web && npx tsx scripts/smoke-live.ts https://scam-lens-two.vercel.app`.

## Known gaps

- **Not a complete scam database** and not a safety guarantee. UPI IDs, phone numbers, Telegram handles, emails and domains have no verified source here; they can only be Reported or Suspected.
- **The live Reported tier holds only synthetic seed data** (labelled). Real reports show only after two independent reporters name the same identifier.
- **No accounts.** Independence is a hashed network fingerprint: people on one network count as one reporter; one person on several networks (Wi-Fi, mobile data, VPN) can count as several. The same applies to daily limits and contests.
- **Contest has no review queue.** Anyone can hide a Reported badge (capped at 3 contests per network per day); hidden entries stay hidden until someone re-enables them in the database.
- **No LLM pass live.** Without an OpenAI-compatible key the card says "AI pass: unavailable" and screenshot reading asks users to paste text instead. The eval measures rules only.
- **Rules are English-first.** Hinglish support is a small starter set; 4 tricky normal messages in the eval still trigger warnings (news and police-awareness messages that quote scam lines).
- **Etherscan free plan:** Ethereum, Polygon and Arbitrum One only, first wallet per check only.
- **Snapshots age.** OFAC and ScamSniffer are as fresh as the last `sync-lists` run (dates shown).
- **Manual checks pending:** browser layout at 375 px, screen-reader and print behaviour ([docs/UI_CHECKLIST.md](docs/UI_CHECKLIST.md)); live Supabase/TigerGraph migrations and the vision model ([docs/HUMAN_TASKS.md](docs/HUMAN_TASKS.md)).
- Nothing here is legal advice.
