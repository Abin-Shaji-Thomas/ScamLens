# Third-party software, data and services

## npm packages (generated from `web/package.json`)

<!-- GENERATED:START deps -->
| package | version | kind |
|---|---|---|
| `@supabase/supabase-js` | ^2.118.0 | runtime |
| `bs58check` | ^4.0.0 | runtime |
| `fast-xml-parser` | ^5.11.2 | runtime |
| `next` | 16.4.3 | runtime |
| `openai` | ^7.45.1 | runtime |
| `react` | 19.3.0 | runtime |
| `react-dom` | 19.3.0 | runtime |
| `react-force-graph-2d` | ^1.29.2 | runtime |
| `tldts` | ^7.4.19 | runtime |
| `viem` | ^2.57.13 | runtime |
| `zod` | ^4.6.7 | runtime |
| `@electric-sql/pglite` | 0.5.8 | dev only |
| `@tailwindcss/turbopack` | ^4 | dev only |
| `@types/node` | ^24.19.2 | dev only |
| `@types/react` | ^19 | dev only |
| `@types/react-dom` | ^19 | dev only |
| `eslint` | ^9 | dev only |
| `eslint-config-next` | 16.4.3 | dev only |
| `tailwindcss` | ^4 | dev only |
| `tsx` | ^4.23.15 | dev only |
| `typescript` | ^5 | dev only |
| `vitest` | ^5.0.5 | dev only |
<!-- GENERATED:END deps -->

No package was added in the final round.

## Data

| Data | Source | Licence or terms | How it is used |
|---|---|---|---|
| OFAC SDN list (digital currency addresses) | US Treasury | US government work, public domain | snapshot in `web/data`, matched locally; date shown on every row |
| ScamSniffer scam-database (address list) | github.com/scamsniffer/scam-database | GPL-3.0, attribution kept | snapshot in `web/data`; about 7 days behind the live feed; the domain list is not used |
| Address security and phishing sites | GoPlus Security API | GoPlus terms | live lookups of wallets and registrable domains |
| On-chain facts | Etherscan V2 API | Etherscan terms | live lookups for the first EVM wallet, free-plan chains only |
| TRON account facts | TronGrid API | TronGrid terms | live lookups |
| Helpline and portal | 1930 and cybercrime.gov.in (I4C, Ministry of Home Affairs) | public information | shown in "What to do now" and the footer |

## Hosted services

Vercel (hosting), Supabase (Postgres), TigerGraph Savanna (graph database). The receipt signing key, the hash pepper and every service key are environment variables, never in the repository.

## Licence note

The repository has no licence file yet: the owner will choose one. The ScamSniffer snapshot is GPL-3.0; keep its attribution and consider that licence when choosing.
