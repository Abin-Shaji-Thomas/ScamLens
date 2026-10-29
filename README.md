# ScamLens

**Evidence-linked scam check for India.** Paste a suspicious chat, screenshot text, wallet address, UPI ID or Telegram handle. ScamLens returns a risk card that keeps three kinds of evidence strictly apart, each with its source:

| Tier | What it means | Where it comes from |
|---|---|---|
| **Verified** | Facts we check ourselves, with source, date and link | OFAC SDN list, ScamSniffer open blacklist, GoPlus address security, Etherscan V2 (Ethereum, BNB, Polygon, Base, Arbitrum), TronGrid |
| **Reported** | Community reports, shown only after **2 independent reporters** within 90 days | ScamLens' own database (hashes + masked identifiers only) |
| **Suspected** | Warning patterns in *your* text, each with the exact quoted phrase and the rule that fired | 18 fixed rules + an optional LLM pass whose output is validated by code |

**Live:** https://scam-lens-two.vercel.app · Hacker House Goa 2026 (Crypto x AI track, team ArcReap)

## How the risk level is decided

- **High signals** - at least one Verified match, **or** an identifier reported by 2+ independent people **and** at least one Suspected signal.
- **Elevated signals** - Suspected signals or reports that don't meet the High rule. **AI/pattern signals alone can never produce High.**
- **Low signals - not a safety guarantee** - nothing found. With no reports the card says: *"No known reports. This does not mean safe."*
- **Failure rule** - any source that errors or times out (5 s) is shown as **unavailable**, never as clean. There is no "safe" status in the code.

## Trust anchors

- **AI proposes, code disposes.** Identifiers are only looked up if they pass checksum/format validation (`web/src/lib/identifiers.ts`): EIP-55 for mixed-case EVM, Base58Check with version byte 0x41 for TRON, Base58Check/bech32/bech32m for BTC, strict formats for UPI, +91 phones, Telegram, email and domains. The LLM may only return `{rule_id, quote}`; anything with an unknown rule id or a quote that is not an exact substring of the input is dropped.
- **No raw chats stored.** `/api/check` works in memory and logs nothing. Reports store only a peppered HMAC-SHA256 of each identifier, a masked display form (e.g. `zz***y@okdemo`) and a hashed reporter fingerprint.
- **Wording.** Identifiers are described as "reported", "linked" or "suspected" - never as belonging to a criminal.

## 90-second demo script

Open the live URL. Each sample is one click under **Try a sample** and is labelled **"Illustrative - not a real investigation"**.

| Time | Do | What appears |
|---|---|---|
| 0:00-0:15 | Say: "ScamLens separates what is proven, what is reported and what is only suspected." | Empty risk card with the three tiers |
| 0:15-0:40 | **Sample 1 - "Digital arrest" call** -> Check | **High signals** without any AI verdict: the UPI ID has no verified source ("UPI is user-reported only") but is **reported by 3 independent people** (synthetic seed, watermarked), and the text has *authority impersonation*, *digital arrest* and *urgency/deadline* signals with the quoted words. Click **Show links** to see the graph: this UPI is linked to two Telegram handles only through a shared wallet. |
| 0:40-1:05 | **Sample 2 - Crypto "investment"** -> Check | **High signals.** Verified: the wallet is **on the OFAC SDN list** (published date + link to the Treasury entry) and **flagged by GoPlus**; ScamSniffer "not listed" with its list date and 7-day-delay note. Suspected: guaranteed returns, fake profit proof, small amount first, move to Telegram. |
| 1:05-1:20 | **Sample 3 - Bank alert** -> Check | **Low signals - not a safety guarantee.** "Never share your OTP" does not fire the OTP rule (negation guard). |
| 1:20-1:30 | Click **Copy evidence pack** | Plain-text summary with the three tiers separated and next steps: call **1930**, file at **cybercrime.gov.in**, contact your bank. Not legal advice. |

Sample 2 uses a real address from the OFAC SDN list so the Verified tier can be shown live; the surrounding chat is invented.
You can replay the demo from a terminal: `cd web && npx tsx scripts/demo-samples.ts https://scam-lens-two.vercel.app`.

## Evaluation (synthetic)

`eval/chats.json` holds 40 **synthetic** labelled chats (20 scam, 20 normal, including hard negatives such as genuine bank alerts, an exchange maintenance notice, a friend asking for a UPI payment and an Amazon delivery OTP). A chat counts as "scam" when the engine finds at least one suspected signal. Output of `npm run eval`, unaltered:

```
ScamLens eval - SYNTHETIC dataset (Illustrative - not a real investigation)
date: 2026-10-29T08:09:22.753Z   model: rules only   chats: 40 (20 scam / 20 normal)

| metric          | value |
|-----------------|-------|
| accuracy        | 90.0% |
| precision       | 83.3% |
| recall          | 100.0% |
| false positives | 4 of 20 normal |
| false negatives | 0 of 20 scam |
| TP / FP / TN / FN | 20 / 4 / 16 / 0 |

false positives: n05 (delivery_otp) <- otp_pin_request; n06 (college_group) <- move_platform; n09 (mutual_fund) <- guaranteed_returns; n18 (whatsapp_family) <- move_platform
false negatives: none
```

The same person wrote the rules and the chats, so these numbers are optimistic and are **not** a real-world accuracy claim. The rules were not tuned after seeing this result.

## Architecture

```
web/                    Next.js 16 app (Vercel root directory)
  src/lib/identifiers.ts      extractor + validation (M2)
  src/lib/verified/           OFAC, ScamSniffer, GoPlus, Etherscan V2, TronGrid (M3)
  src/lib/signals/            18 rules, regex pass, validated LLM pass (M4)
  src/lib/risk.ts             tier rules
  src/lib/reports/            hashing, masking, 2-reporter rule, contest (M5)
  src/lib/graph/              findLinks: TigerGraph REST or Postgres recursive CTE (M5)
  src/lib/evidence-pack.ts    copy-ready summary (M6)
  db/schema.sql               tables + SQL functions (Supabase or local PGlite)
  data/                       OFAC + ScamSniffer snapshots written by scripts/sync-lists.ts
  scripts/                    sync-lists, smoke-verified, graph-demo, demo-samples
graph/                  TigerGraph schema + GSQL queries Q1-Q4
eval/                   synthetic labelled chats + scorer
docs/SPEC.md            project spec
```

API: `POST /api/check {text}`, `POST /api/report {identifiers, category, consent:true}`, `POST /api/report/contest {identifier, reason}`, `POST /api/graph {type, value}`, `GET /api/health`. Every request body is validated with zod.

**Link graph (TigerGraph).** Q1 UPI -> wallet -> Telegram linked only through a shared wallet; Q2 wallet -> up to 2 payment hops -> flagged address; Q3 different Telegram handles reported with the same wallet, with cluster size; Q4 neighbourhood for the graph view. A **hub filter** drops nodes with more than `GRAPH_HUB_MAX` (default 25) distinct counterparties and any exchange address, so unrelated people are not linked. TigerGraph runs the traversals when `TG_HOST`/`TG_SECRET` are set; Postgres recursive CTEs answer the same questions otherwise, and as an automatic fallback. `scripts/tg-setup.ts` proves both give identical answers. Full explanation: [graph/README.md](graph/README.md).

## Running locally

```powershell
cd web
npm install
copy .env.example .env.local   # fill in what you have; everything is optional for a first run
npm run dev                    # http://localhost:3000
npm run lint; npm run typecheck; npm test; npm run eval
npx tsx scripts/sync-lists.ts       # refresh OFAC + ScamSniffer snapshots in web/data
npx tsx scripts/smoke-verified.ts   # live check of the verified tier
npx tsx scripts/graph-demo.ts       # seed synthetic data into local Postgres (PGlite) and run Q1-Q3
```

| Env var | Needed for | Without it |
|---|---|---|
| `ETHERSCAN_API_KEY` | EVM on-chain history | Etherscan lines show "unavailable" |
| `TRONGRID_API_KEY` | higher TronGrid rate limits | works keyless at low volume |
| `OPENAI_API_KEY`, `OPENAI_MODEL` (`OPENAI_BASE_URL` optional) | LLM signal pass | rules only; card says "AI pass: unavailable" |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REPORT_HASH_PEPPER` | reports, contest, graph | Reported tier shows "unavailable" |
| `TG_HOST`, `TG_GRAPH`, `TG_SECRET` | TigerGraph backend (setup: `npx tsx scripts/tg-setup.ts`) | Postgres fallback is used |
| `ETHERSCAN_PLAN=paid` (optional) | BNB Chain and Base lookups | free-plan chains only |

**Supabase setup:** in the SQL editor run `web/db/schema.sql`, then `web/db/supabase-grants.sql` (locks everything to the service-role key). Set the three variables in `web/.env.local` and in Vercel. Optional demo data: `npx tsx scripts/graph-demo.ts --supabase` (all rows `synthetic=true`, shown with the watermark).

## Data sources and licences

- **OFAC SDN list** - U.S. Treasury, `sanctionslistservice.ofac.treas.gov` (`SDN.XML`), digital-currency address fields. Snapshot date shown on every line.
- **ScamSniffer scam-database** - `github.com/scamsniffer/scam-database`, `blacklist/all.json` address list, GPL-3.0. The public copy is about 7 days behind ScamSniffer's live feed; the UI says so. Its address list changes rarely (most daily updates add domains).
- **GoPlus** address security API, **Etherscan V2** API, **TronGrid** API - queried live per check.
- Helpline **1930** and **cybercrime.gov.in** - Indian Cyber Crime Coordination Centre (I4C), Ministry of Home Affairs.

## Limitations

- **Not a complete scam database** and not a safety guarantee. "Low signals" means we found nothing, not that something is safe.
- **UPI IDs, phone numbers and Telegram handles have no public verified source.** They can only appear as Reported (after 2 independent reporters) or through Suspected text patterns.
- **The live Reported tier currently holds only synthetic seed data** (`synthetic=true`, shown with the "Illustrative" watermark). Real reports appear only once two independent people report the same identifier.
- **Etherscan free plan**: Ethereum, Polygon and Arbitrum are looked up; BNB Chain and Base need a paid Etherscan plan (`ETHERSCAN_PLAN=paid`) and show "unavailable" otherwise. To stay under the free plan's rate limit, on-chain history is fetched for the first EVM wallet in a message only (about 8 s, cached 10 minutes).
- **No LLM pass in the live demo**: the AI signal pass needs an OpenAI-compatible key. Without it the card says "AI pass: unavailable" and uses the 18 fixed rules only, which is what the eval above measures.
- **Snapshots age.** OFAC and ScamSniffer data are as fresh as the last `sync-lists` run (dates are shown).
- **Rules are English-first.** Hindi/Hinglish phrasing and screenshots are not covered yet; the eval set is small, synthetic and written by the same author as the rules.
- **Fingerprints are approximate** (HMAC of the client IP only, so changing browsers does not create a new reporter). A person with two networks (Wi-Fi and mobile data) can still count as two reporters, and people sharing one IP count as one. Reports expire after 90 days and can be contested. Graph links additionally require two different reporters.
- **Contest has no review queue yet**: a contested identifier is hidden from public badges until someone re-enables it in the database.
- Nothing here is legal advice.
