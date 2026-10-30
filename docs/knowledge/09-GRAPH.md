# Link graph

## In plain words

One scam often reuses the same money trail across many victims: a UPI ID in one chat, a Telegram handle in another, the same wallet behind both. The link graph connects identifiers that appear together in independent reports or that are linked by on-chain payments, and answers questions such as "is this UPI ID linked to any Telegram handle through a shared wallet?". It runs on TigerGraph; if TigerGraph is unavailable, the same queries run in Postgres and the card says which one answered.

## Details

Data model (`graph/schema.gsql`):

```
 (UPI) --MENTIONS-- (Report) --MENTIONS-- (Wallet) --MENTIONS-- (Report) --MENTIONS-- (TelegramHandle)
                                              |
                                            PAID (directed on-chain transfer)
                                              v
                                          (Wallet, flagged_source)
```

- Identifier vertices: `Wallet`, `UPI`, `TelegramHandle`, `PhoneNumber`, `Domain`. The primary id is the peppered HMAC hash; `display` is the masked form. Raw identifiers and chats never reach TigerGraph.
- `Report`: one community submission with its evidence sentence and a `reporter_key`.

Queries (`graph/queries.gsql`, mirrored in `web/db/schema.sql`):

| Query | Question |
|---|---|
| Q1 `q1_upi_wallet_telegram` | Which Telegram handles are linked to this UPI ID only through a shared wallet (two different reporters)? |
| Q2 `q2_payment_to_flagged` | Does this wallet pay, within 2 hops, an address flagged by a list? |
| Q3 `q3_telegram_clusters` | Which wallets are paid by different Telegram handles, and how large is each cluster? |
| Q4 `q4_neighbourhood` | Everything within 2 hops, for the drawing |

Hub filter: no query links people through an exchange address or a node with more than <!-- FACT:hub_max -->25<!-- /FACT --> distinct counterparties (`GRAPH_HUB_MAX`), computed at query time.

Fallback and parity: `web/src/lib/graph/index.ts` picks TigerGraph when `TG_HOST` and `TG_SECRET` are set, and falls back to the Postgres functions on any error, labelling the view "postgres (TigerGraph unavailable)". `npx tsx scripts/tg-setup.ts` runs every Q1, Q2 and Q4 case plus Q3 on both backends and prints `N/N queries SAME`.

Drawing (`web/src/components/FitGraph.tsx`, loaded by `web/src/components/GraphPanel.tsx` in the browser only): the checked identifier is a filled black circle, others hollow; links are 1px grey; a link whose two ends are both named in one listed path is 2.5px in the alert colour. Labels sit below each circle on a white halo. The data is memoised (a new object on every render used to restart the layout), the layout runs a bounded cooldown, and when it settles the view is zoomed to fit with 40 px padding (instantly under reduced motion, where the layout is precomputed); a new canvas size fits again. Canvas height: 300 px below 500 px wide, otherwise 40% of the width within 360-480 px (`web/src/lib/graph/drawing.ts`). Measured 2026-10-30 in headless Edge on sample 1: the whole graph inside the canvas with 26-58 px margins at 375, 768 and 1440 px (after a resize and on a fresh load), no overflow, console clean.

Live status: verified on 2026-10-29 (19/19 SAME, recorded in `graph/README.md`). This round's re-run result is recorded below by step J2.

**Live status (2026-10-30, TigerGraph finish round):** the workspace is Running and answers the app (`Graph backend: tigergraph`). After the owner applied the global migration 001 by hand in the Savanna GSQL editor, `npx tsx scripts/tg-setup.ts` reported `migration 001 already applied (Report.reporter_key exists)`, installed Q1-Q4, loaded 22 vertices and 21 edges and ended with `parity TigerGraph vs Postgres: 19/19 queries SAME`. Savanna has no auto-start, so an idle workspace can suspend; the app then answers from Postgres, labelled `postgres (TigerGraph unavailable)`. (Earlier the same day the workspace was suspended and the fallback was confirmed through the app.)

**Q2 on the demo data (checked 2026-10-30, read-only):** 4 of the 7 seeded demo wallets have a payment path to a flagged demo address within 2 hops, and TigerGraph and Postgres agree (`q2: 4 of 7 case(s) return rows`). An earlier tg-setup printed only the first wallet's result, which is empty, so Q2 looked as if it found nothing; it now prints how many cases return rows. The sample messages do not contain these demo wallets, so Q2 shows a path only when one is pasted, for example `0x93776c64a1e60f64dec9cb7bcf0638c4ffe432d8` (2 hops: `0x9377***32d8 -> 0xc846***38Ba -> 0x1DD0***9A07`, labelled demo data). When a wallet has no path, the panel lists no Q2 line; it never claims a path it did not find.

One-time global migration: graphs created before round 1 lack `Report.reporter_key`. Adding it is a GLOBAL schema change, which the graph-scoped token (`TG_SECRET`) is not allowed to make. `tg-setup.ts` therefore reads the schema first (`GET /gsql/v1/schema/graphs/<graph>`): if the attribute exists it prints `migration 001 already applied` and goes on; if it is missing it stops with exit code 2 and "HUMAN STEP REQUIRED", printing `graph/migrations/001_report_reporter_key.gsql` to paste into the Savanna GSQL editor (`USE GLOBAL`, then a global schema change job that adds `reporter_key STRING DEFAULT ""`), after which you re-run `tg-setup.ts`. The owner applied it on 2026-10-30.

## Where in the code

- `graph/schema.gsql`, `graph/queries.gsql`, `graph/migrations/`: TigerGraph schema and queries.
- `graph/README.md`: the longer explanation and setup steps.
- `web/src/lib/graph/tigergraph.ts`: REST client and backend.
- `web/src/lib/graph/postgres.ts`: Postgres backend.
- `web/src/lib/graph/index.ts`: backend choice and fallback.
- `web/src/lib/graph/view.ts`: builds the view for one identifier.
- `web/src/components/FitGraph.tsx` and `web/src/lib/graph/drawing.ts`: drawing, fit and canvas size.
- `web/src/lib/graph/tg-sync.ts`: live and full sync payloads.
- `web/scripts/tg-setup.ts`: migration check, install, load, parity.
- `web/src/lib/graph/migrations.ts`: the migration decision (skip or human step) and secret masking for error details.
- `web/src/app/api/graph/route.ts`: the route.

## How to change it safely

Change a query in both `graph/queries.gsql` and `web/db/schema.sql`, then run `npx tsx scripts/tg-setup.ts` and require `N/N queries SAME`. Never remove the hub filter. Raw identifiers must never be sent to TigerGraph.

## How it is tested

`web/src/lib/graph/tigergraph.test.ts`: the Postgres SQL against an independent in-memory reference (`web/src/lib/graph/reference.ts`), TigerGraph response mapping, the hub filter and the two-reporter rule; live parity through `web/scripts/tg-setup.ts`.

The PGlite suites run with an explicit 30 s test and hook timeout, because starting Postgres in WebAssembly takes about 8 s when several suites start at once (see [12-TESTING-AND-EVAL.md](12-TESTING-AND-EVAL.md)).

## Known limits

A suspended Savanna workspace takes up to a minute to wake; the first lookup then shows the waking message or falls back to Postgres. Removing an upheld report from TigerGraph needs a manual REST call (documented in `docs/MODERATION.md`, untested).
