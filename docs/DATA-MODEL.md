# Data model

Postgres (Supabase) is the system of record; TigerGraph holds a copy of the links for multi-hop queries. Everything about a person is stored as a keyed hash (HMAC-SHA256 with the server's `REPORT_HASH_PEPPER`) plus a masked display; there are no names, IP addresses or chats. Diagrams: [ARCHITECTURE.md](ARCHITECTURE.md).

## Tables and functions (generated from `web/db/*.sql`)

<!-- GENERATED:START db -->
| object | kind | file |
|---|---|---|
| `reports` | table | `web/db/schema.sql` |
| `reports_fp_created` | index | `web/db/schema.sql` |
| `graph_edges` | table | `web/db/schema.sql` |
| `graph_edges_unique_submission` | unique index | `web/db/schema.sql` |
| `graph_edges_src` | index | `web/db/schema.sql` |
| `graph_edges_dst` | index | `web/db/schema.sql` |
| `flagged_addresses` | table | `web/db/schema.sql` |
| `exchange_addresses` | table | `web/db/schema.sql` |
| `add_payment_edge` | function | `web/db/schema.sql` |
| `add_flagged` | function | `web/db/schema.sql` |
| `add_exchange` | function | `web/db/schema.sql` |
| `active_edges` | view | `web/db/schema.sql` |
| `submit_report` | function | `web/db/schema.sql` |
| `reported_counts` | function | `web/db/schema.sql` |
| `contest_identifier` | function | `web/db/schema.sql` |
| `hub_nodes` | function | `web/db/schema.sql` |
| `co_edges` | view | `web/db/schema.sql` |
| `q1_upi_wallet_telegram` | function | `web/db/schema.sql` |
| `q2_payment_to_flagged` | function | `web/db/schema.sql` |
| `q3_telegram_clusters` | function | `web/db/schema.sql` |
| `q4_neighbourhood` | function | `web/db/schema.sql` |
| `usage_counters` | table | `web/db/schema.sql` |
| `increment_usage` | function | `web/db/schema.sql` |
| `contests` | table | `web/db/migrations/002_contest_policy.sql` |
| `contests_hash` | index | `web/db/migrations/002_contest_policy.sql` |
| `contests_status` | index | `web/db/migrations/002_contest_policy.sql` |
| `contest_identifier_v2` | function | `web/db/migrations/002_contest_policy.sql` |
| `reported_counts_v2` | function | `web/db/migrations/002_contest_policy.sql` |
| `purge_old_contests` | function | `web/db/migrations/003_contest_retention.sql` |
| `cases` | table | `web/db/migrations/004_cases_and_feedback.sql` |
| `cases_submission` | index | `web/db/migrations/004_cases_and_feedback.sql` |
| `cases_delete_hash` | index | `web/db/migrations/004_cases_and_feedback.sql` |
| `cases_expires` | index | `web/db/migrations/004_cases_and_feedback.sql` |
| `feedback` | table | `web/db/migrations/004_cases_and_feedback.sql` |
| `submit_case` | function | `web/db/migrations/004_cases_and_feedback.sql` |
| `delete_case_by_code` | function | `web/db/migrations/004_cases_and_feedback.sql` |
| `submit_feedback` | function | `web/db/migrations/004_cases_and_feedback.sql` |
| `feedback_counts` | function | `web/db/migrations/004_cases_and_feedback.sql` |
| `case_trail_summary` | function | `web/db/migrations/004_cases_and_feedback.sql` |
| `case_trail_cluster` | function | `web/db/migrations/004_cases_and_feedback.sql` |
| `purge_expired_cases` | function | `web/db/migrations/004_cases_and_feedback.sql` |
<!-- GENERATED:END db -->

## What each table holds

| Table | Rows | Kept |
|---|---|---|
| `reports` | one per identifier per reporter network: hash, masked display, type, category, fingerprint hash, submission id, contested, synthetic | 90 days |
| `graph_edges` | `co_reported` (two identifiers in one report) and `payment` (on-chain) links, with an evidence line and a short reporter key | with the report |
| `flagged_addresses`, `exchange_addresses` | wallets on a verified list; exchange-style hot wallets the hub filter drops | until removed |
| `usage_counters` | hashed network key, route, day, count | about 7 days |
| `contests` (002) | identifier hash, reason (moderator only), status | until resolved, at most 90 days (003) |
| `cases` (004) | submission id, category, channel, loss band, month, rule ids, synthetic, optional redacted excerpt, delete-code hash | 90 days |
| `feedback` (004) | identifier hash (or `rules:<ids>`), fingerprint hash, verdict, reason codes, rule ids | 90 days |

## TigerGraph schema (`graph/schema.gsql`)

Vertices `Wallet`, `UPI`, `TelegramHandle`, `PhoneNumber`, `Domain` (primary id: identifier hash; attributes kind, masked display, flagged source, is_exchange) and `Report` (submission id, evidence, synthetic, reporter key). Edges `MENTIONS` (Report to identifier, undirected) and `PAID` (Wallet to Wallet, directed). Queries Q1-Q4 are in `graph/queries.gsql`; the same queries in SQL are in `web/db/schema.sql` and `web/src/lib/graph/postgres.ts`.

## Migrations, in order

| Migration | What | How it is applied |
|---|---|---|
| `web/db/schema.sql` + `web/db/supabase-grants.sql` | base tables, functions, row-level security | owner, Supabase SQL editor (done) |
| `graph/migrations/001_report_reporter_key.gsql` | adds `Report.reporter_key` (a global TigerGraph change) | owner, Savanna GSQL editor (done) |
| `web/db/migrations/002_contest_policy.sql` | contests stay visible and labelled | owner, SQL editor (done) |
| `web/db/migrations/003_contest_retention.sql` | `purge_old_contests()` | owner, SQL editor (done) |
| `web/db/migrations/004_cases_and_feedback.sql` | cases, feedback and their functions | owner, SQL editor: **HUMAN STEP, pending** |

Database migrations in the repository: <!-- FACT:db_migrations -->`002_contest_policy.sql`, `003_contest_retention.sql`, `004_cases_and_feedback.sql`<!-- /FACT -->; graph migrations: <!-- FACT:graph_migrations -->`001_report_reporter_key.gsql`<!-- /FACT -->. Every migration is idempotent, and the code works before and after each one.
