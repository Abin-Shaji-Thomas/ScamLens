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

Drawing (`web/src/components/GraphPanel.tsx`): the checked identifier is a filled black circle, others hollow; links are 1px grey; a link whose two ends are both named in one listed path is 2.5px in the alert colour.

Live status: verified on 2026-10-29 (19/19 SAME, recorded in `graph/README.md`). This round's re-run result is recorded below by step J2.

**2026-10-30 re-run (final round, J2):** the scope was reviewed first (queries are created for `TG_GRAPH` only, upserts go to that graph, nothing is deleted; the one global step is migration `graph/migrations/001_report_reporter_key.gsql`, which adds an attribute to the global `Report` vertex type). The workspace did not wake: every `/restpp/echo` for 5 minutes returned HTTP 500 "Failed to start workspace. Auto start is not enabled for this workspace." `tg-setup.ts` was therefore not run and nothing in TigerGraph changed. The app falls back as designed: `POST /api/graph` for the sample 1 UPI ID answered `backend: "postgres (TigerGraph unavailable)"`, 5 nodes, 2 paths. Resuming the workspace (or enabling auto start) is a human task in `docs/HUMAN_TASKS.md`.

## Where in the code

- `graph/schema.gsql`, `graph/queries.gsql`, `graph/migrations/`: TigerGraph schema and queries.
- `graph/README.md`: the longer explanation and setup steps.
- `web/src/lib/graph/tigergraph.ts`: REST client and backend.
- `web/src/lib/graph/postgres.ts`: Postgres backend.
- `web/src/lib/graph/index.ts`: backend choice and fallback.
- `web/src/lib/graph/view.ts`: builds the view for one identifier.
- `web/src/lib/graph/tg-sync.ts`: live and full sync payloads.
- `web/scripts/tg-setup.ts`: schema, install, load, parity.
- `web/src/app/api/graph/route.ts`: the route.

## How to change it safely

Change a query in both `graph/queries.gsql` and `web/db/schema.sql`, then run `npx tsx scripts/tg-setup.ts` and require `N/N queries SAME`. Never remove the hub filter. Raw identifiers must never be sent to TigerGraph.

## How it is tested

`web/src/lib/graph/tigergraph.test.ts`: the Postgres SQL against an independent in-memory reference (`web/src/lib/graph/reference.ts`), TigerGraph response mapping, the hub filter and the two-reporter rule; live parity through `web/scripts/tg-setup.ts`.

## Known limits

A suspended Savanna workspace takes up to a minute to wake; the first lookup then shows the waking message or falls back to Postgres. Removing an upheld report from TigerGraph needs a manual REST call (documented in `docs/MODERATION.md`, untested).
