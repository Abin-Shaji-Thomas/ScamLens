# How ScamLens uses TigerGraph

## Why a graph at all

One scam usually reuses the same money trail across many victims: a "refund desk" UPI ID in one chat, a Telegram "support" handle in another, and the same USDT wallet behind both. Each victim sees only their own piece. A graph lets ScamLens answer questions that span reports:

| Query | Question | Why it matters |
|---|---|---|
| **Q1** `q1_upi_wallet_telegram` | Which Telegram handles are linked to this UPI ID *only* through a shared wallet? | Connects two pieces that no single victim ever saw together. |
| **Q2** `q2_payment_to_flagged` | Does this wallet send money, within 2 hops, to a flagged address? | Follows the money from a "harmless" wallet to a sanctioned or blacklisted one. |
| **Q3** `q3_telegram_clusters` | Which wallets are being paid by *different* Telegram handles, and how big is each cluster? | Shows that many handles are one operation. |
| **Q4** `q4_neighbourhood` | Everything within 2 hops of this identifier. | Feeds the force-graph view on the risk card. |

## The data model (`schema.gsql`)

```
 (UPI) --MENTIONS-- (Report) --MENTIONS-- (Wallet) --MENTIONS-- (Report) --MENTIONS-- (TelegramHandle)
                                              |
                                            PAID (on-chain transfer, directed)
                                              v
                                          (Wallet, flagged_source = "OFAC ...")
```

- **Identifier vertices**: `Wallet`, `UPI`, `TelegramHandle`, `PhoneNumber`, `Domain` (emails share `Domain`, told apart by `kind`). Each one stores `kind`, `display`, `flagged_source` and `is_exchange`. Its primary id is the **peppered HMAC-SHA256 hash** the app already stores, and `display` is the masked form such as `zz***d@okdemo`. Raw UPI IDs, phone numbers and chats never reach TigerGraph.
- **`Report` vertex**: one community report. It holds the evidence sentence ("Named together in one investment report on 2026-10-29") and whether it is synthetic demo data.
- **`MENTIONS`** joins a Report to each identifier it named. Two identifiers are "co-reported" when they share a Report.
- **`PAID`** is a directed transfer between two wallets.

## The hub filter, and why it runs inside the queries

A crypto exchange's hot wallet touches thousands of unrelated people. If ScamLens linked everyone who ever paid an exchange, it would accuse innocent users. So every query refuses to link *through* a node that is either:
- flagged `is_exchange`, or
- connected to more than `hub_max` distinct counterparties (`GRAPH_HUB_MAX`, default 25), where counterparties are the identifiers it was reported with plus the wallets it paid or was paid by.

The counterparty count is computed **at query time** (`SetAccum<VERTEX> @nbrs`), so the filter is always current as new reports arrive.

## How data gets there

Postgres (Supabase) is the source of truth, and TigerGraph holds the same links for traversal:
1. **Full sync**: `npx tsx scripts/tg-setup.ts --load` reads `graph_edges`, `flagged_addresses` and `exchange_addresses` from Supabase (never the `reports` table, which holds reporter fingerprints). It builds one `Report` vertex per submission plus its `MENTIONS` and `PAID` edges, then upserts them with `POST /restpp/graph/{graph}`.
2. **Live sync**: every new report submitted at `/api/report` is upserted into TigerGraph immediately. If TigerGraph is down, the report is still saved in Postgres, and the next full sync catches up.

## How the app queries it

`web/src/lib/graph/tigergraph.ts` calls the installed queries with `GET /restpp/query/{graph}/{query}`. It authenticates with a token from `POST /gsql/v1/tokens`, falling back to the `GSQL-Secret` header. It then maps the results to exactly the same row shapes as the Postgres version. If TigerGraph fails or times out, the graph view answers from Postgres and labels itself "postgres (TigerGraph unavailable)", so the demo never breaks silently.

The response also carries `elapsedMs`, so the graph note shows how long TigerGraph took ("Graph backend: tigergraph (N ms)").

`GET /api/graph/stats` reads TigerGraph's built-in vertex and edge counts (`POST /restpp/builtins/ScamLens` with `stat_vertex_number` / `stat_edge_number`) for the /about page; the Postgres copy answers when TigerGraph cannot.

## Proving the two backends agree

`npx tsx scripts/tg-setup.ts` runs every Q1/Q2/Q4 case for every UPI and wallet, plus Q3, on **both** TigerGraph and Postgres, against the same Supabase data. It prints `N/N queries SAME`, or the exact differences. The Postgres SQL is itself checked against an independent in-memory implementation in the unit tests.

## Setup (once)

1. Create a TigerGraph Savanna account and a workspace. A small free-credit workspace is enough.
2. Savanna → **Database Secrets** → **Create Secret** for that workspace, then copy it (it is shown only once).
3. Copy the workspace host from the workspace's **Connect** panel (`https://<id>.i.tgcloud.io`).
4. In `web/.env.local` set `TG_HOST=...`, `TG_SECRET=...` and `TG_GRAPH=ScamLens`. Add the same three in Vercel → Settings → Environment Variables and redeploy.
5. `cd web && npx tsx scripts/tg-setup.ts` creates the schema, installs Q1-Q4 (a few minutes), loads the data and runs the parity check.

## The one global migration

One-time global migration: graphs created before round 1 lack `Report.reporter_key`. Adding it is a GLOBAL schema change, which the graph-scoped token (`TG_SECRET`) is not allowed to make. `tg-setup.ts` therefore reads the schema first (`GET /gsql/v1/schema/graphs/<graph>`): if the attribute exists it prints `migration 001 already applied` and goes on; if it is missing it stops with exit code 2 and "HUMAN STEP REQUIRED", printing `graph/migrations/001_report_reporter_key.gsql` to paste into the Savanna GSQL editor (`USE GLOBAL`, then a global schema change job that adds `reporter_key STRING DEFAULT ""`), after which you re-run `tg-setup.ts`. The owner applied it on 2026-10-30.

## Indian synthetic dataset (final round, 2026-10-30)

`web/scripts/seed-india-cases.ts --apply` adds 56 labelled synthetic cases in 10 campaigns (`docs/DATASET.md`) through the normal report path. `tg-setup.ts --load` then loaded 104 vertices and 119 edges and printed `parity TigerGraph vs Postgres: 63/63 queries SAME`, plus the dataset checks: Q1 non-empty for 4 cases, Q2 for 8, Q3 3 clusters, and no path through either exchange-style address (the hub filter drops them; a Q2 case that starts at an exchange is not a path through it). `--remove` deletes only that dataset's rows.

## Verified on a live Savanna workspace (2026-10-30)

After the owner applied migration 001 by hand, `npx tsx scripts/tg-setup.ts` printed `migration 001 already applied (Report.reporter_key exists)` (no "Access Denied"), created and installed Q1-Q4, accepted 22 vertices / 21 edges and ended with `parity TigerGraph vs Postgres: 19/19 queries SAME` (Q1: 1 of 2 UPI cases returns rows; Q2: 4 of 7 wallets have a path to a flagged demo address; Q3: 1 cluster of 3 handles). The app's graph note says `Graph backend: tigergraph`.

## Verified on a live Savanna workspace (2026-10-29)

`npx tsx scripts/tg-setup.ts` against the project's Savanna workspace: schema created, all four queries compiled and installed, 22 vertices / 21 edges accepted from Supabase, and **19/19 queries SAME** as Postgres (every UPI for Q1, every wallet for Q2 and Q4, plus Q3). Re-run with `GRAPH_HUB_MAX=3`, so that the shared wallet becomes a hub: Q1 returns nothing on both backends, again 19/19 SAME.

`PhoneNumber` (not `Phone`) avoids a clash with the global `Phone` type that Savanna's starter *Transaction_Fraud* graph defines.
