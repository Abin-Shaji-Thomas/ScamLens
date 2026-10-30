# Architecture

## In plain words

ScamLens is one Next.js app on Vercel. The pages are mostly static; five small server functions do the work. Reports and counters live in Supabase (Postgres). The link graph lives in TigerGraph, with the same queries in Postgres as a fallback. Sanctions and blacklist data are snapshots stored in the repo; GoPlus, Etherscan and TronGrid are called live. If anything outside the app fails, the card says so instead of guessing.

## Details

```
                       +-------------------------- Vercel (Next.js 16) ---------------------------+
  browser  -- HTTPS -> | static pages: /, /about, 404           server routes (Node runtime):     |
  (no keys)            | client components (CheckForm, ...)     /api/check      /api/graph        |
                       |                                        /api/report     /api/report/contest|
                       |                                        /api/transcribe /api/health       |
                       +-----------+--------------------------+---------------+------------------+
                                   |                          |               |
              local JSON snapshots |               live HTTPS |               | service-role key (server only)
          web/data/ofac-*.json     |   GoPlus, Etherscan V2,  |               v
          web/data/scamsniffer-*   |   TronGrid               |     Supabase Postgres: reports, graph_edges,
                                   v                          v     usage_counters, contests (+ SQL functions)
                            Verified tier              Verified tier            |
                                                                                | sync (scripts/tg-setup.ts)
                                                                                v
                                                                     TigerGraph Savanna (graph Q1-Q4)
                                                                     fallback: same queries in Postgres
```

### What runs where
| Part | Runs | Holds secrets? |
|---|---|---|
| Pages and components | browser (after a static render) | no |
| `/api/*` routes | Vercel serverless functions (Node) | yes, via `process.env` only |
| OFAC and ScamSniffer lists | JSON files bundled with the app, refreshed by `web/scripts/sync-lists.ts` | no |
| Reports, counters, contests | Supabase Postgres, reached with the service-role key | key on the server only |
| Graph | TigerGraph Savanna via REST (token from `TG_SECRET`), else Postgres functions | yes |

### Failure behaviour
| What fails | What the user sees |
|---|---|
| A verified source (timeout, error, bad key) | That row says "Unavailable" with the reason; the risk reasons add "source(s) unavailable - result is incomplete" |
| Supabase | "Reports database unavailable (...). This is not a clean result." and never "No known reports" |
| Usage store | Limits count in memory per server instance; the check continues |
| TigerGraph | Graph answers from Postgres and says `postgres (TigerGraph unavailable)`; a slow wake-up shows "The graph database is waking up..." |
| AI provider (if ever enabled) | "AI pass: unavailable (...)"; rules still run |

## Where in the code

- `web/src/app/`: pages and API routes (list below).
- `web/src/lib/verified/`: sources.
- `web/src/lib/reports/`: reports and the database client.
- `web/src/lib/graph/`: graph backends.
- `web/src/lib/usage.ts`: abuse guard.
- `web/next.config.ts`: security headers.

Routes (generated from `web/src/app`):

<!-- GENERATED:START routes -->
- /.well-known/scamlens-receipt-key.json (API route, `web/src/app/.well-known/scamlens-receipt-key.json/route.ts`)
- /about (page, `web/src/app/about/page.tsx`)
- /api/check (API route, `web/src/app/api/check/route.ts`)
- /api/graph (API route, `web/src/app/api/graph/route.ts`)
- /api/health (API route, `web/src/app/api/health/route.ts`)
- /api/report/contest (API route, `web/src/app/api/report/contest/route.ts`)
- /api/report (API route, `web/src/app/api/report/route.ts`)
- /api/transcribe (API route, `web/src/app/api/transcribe/route.ts`)
- /api/verify-receipt (API route, `web/src/app/api/verify-receipt/route.ts`)
- / (page, `web/src/app/page.tsx`)
- /patterns (page, `web/src/app/patterns/page.tsx`)
- /verify (page, `web/src/app/verify/page.tsx`)
<!-- GENERATED:END routes -->

## How to change it safely

Keep secrets in server code only (never in a component). A new external call must have a timeout and turn every failure into `unavailable`. Run `npx tsx scripts/check-headers.ts <url>` after changing headers.

## How it is tested

Mocked sources in `web/src/lib/verified/verified.test.ts`, the real SQL in PGlite (`web/src/lib/reports/reports.test.ts`, `web/src/lib/usage.test.ts`), graph parity in `web/src/lib/graph/tigergraph.test.ts`, headers in `web/src/lib/f1-safety.test.ts`.

## Known limits

Each Vercel instance has its own Etherscan rate limiter and memory fallback, so limits are approximate across instances.
