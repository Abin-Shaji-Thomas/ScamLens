# Data sources

## In plain words

The Verified tier uses five sources. Two are lists stored as snapshots in the repo (the US sanctions list and ScamSniffer's blacklist); three are live APIs (GoPlus, Etherscan, TronGrid). Each result row shows the source, the date and a link so anyone can check it themselves. A source that fails is shown as "Unavailable" and never as a clean result.

## Details

| Source | Covers | Licence / terms | Freshness | Limits | When it fails |
|---|---|---|---|---|---|
| OFAC SDN list (US Treasury) | Crypto addresses listed in sanctions (EVM, TRON, BTC and others) | US government work, public domain | Snapshot; dates shown on the card and /about | Only addresses OFAC lists | Snapshot is local, so it does not fail at run time |
| ScamSniffer scam-database (address list) | Scam-linked EVM addresses | GPL-3.0 (upstream repository licence) | Public copy is about 7 days behind ScamSniffer's live feed; snapshot date shown | Addresses only; the domain list is not used (too large) | Local snapshot |
| GoPlus address security API | Flags for Ethereum and TRON addresses | GoPlus terms | Live | Rate limits unknown; per-request timeout | Row "Unavailable" |
| GoPlus phishing site API | Website domains on GoPlus's phishing-site list (finish round) | GoPlus terms | Live | Up to 5 domains per check (`MAX_DOMAINS`); only the domain is sent; per-request timeout | Row "Unavailable" |
| Etherscan V2 API | On-chain facts (type, balance, first and last transaction) | Etherscan terms | Live, 10-minute cache | Free plan: the chains marked "yes" below, 2 requests per second, first wallet per message only | Row "Unavailable", or "skipped" with the reason |
| TronGrid | TRON account facts, with a Tronscan link | TronGrid terms | Live | Works without a key at lower limits | Row "Unavailable" |

Enabled chains (generated from `EVM_CHAINS`):

<!-- GENERATED:START chains -->
| chain | chain id | checked on the free Etherscan plan |
|---|---|---|
| Ethereum | 1 | yes |
| BNB Chain | 56 | no (needs ETHERSCAN_PLAN=paid) |
| Polygon | 137 | yes |
| Base | 8453 | no (needs ETHERSCAN_PLAN=paid) |
| Arbitrum One | 42161 | yes |
<!-- GENERATED:END chains -->

### What is not covered
- UPI IDs, phone numbers, Telegram handles and emails have no verified source; they can only be Reported or Suspected.
- Website domains: checked against GoPlus's phishing-site list only. ScamSniffer's domain list measured 9.1 MB on 2026-10-29, over the 8 MB budget, so it is not used; a check with a domain says so in a notice ("Website domains are checked only against GoPlus's phishing-site list ...").
- Domain check probe (2026-10-30): `GET https://api.gopluslabs.io/api/v1/phishing_site?url=<domain>` needs no key; it answered `phishing_site: 1` for the phishing domain in GoPlus's own API example and `0` for example.com and a reserved demo domain, in 0.2-0.6 s. So the domain check was built.
- Bitcoin addresses: OFAC only.

### Refreshing the lists
`cd web && npx tsx scripts/sync-lists.ts` downloads the current OFAC SDN XML and the ScamSniffer address list and writes versioned JSON with `fetched_at` and the source URL into `web/data/`. Commit the new files.

## Where in the code

- `web/src/lib/verified/ofac.ts`, `web/src/lib/verified/scamsniffer.ts`, `web/src/lib/verified/goplus.ts`, `web/src/lib/verified/etherscan.ts`, `web/src/lib/verified/tron.ts`: one file per source.
- `web/src/lib/verified/index.ts`: which sources run for which identifier, and the failure rule.
- `web/src/lib/verified/lists.ts` and `web/src/lib/verified/lists-schema.ts`: loading and validating the snapshots.
- `web/data/`: the snapshots.
- `web/scripts/sync-lists.ts`: refresh script.
- `docs/CHAIN_SUPPORT.md`: the live probe of which chains the free Etherscan plan allows.

## How to change it safely

A new source must return `unavailable` for every error (see `runTask`), carry a working link, and never mark anything "safe". Add a mocked test for success, failure and timeout.

## How it is tested

`web/src/lib/verified/verified.test.ts` mocks every source: matches, no match, timeouts, bad keys and schema errors all behave as described above. `web/scripts/smoke-verified.ts` checks one real OFAC address live.

## Known limits

Snapshots age between syncs. GoPlus and Etherscan results are what those services report; ScamSniffer data is about a week behind. TronGrid without a key may hit rate limits under load (UNKNOWN at what volume).
