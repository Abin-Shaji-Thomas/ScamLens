# Reports and privacy

## In plain words

Anyone can report the identifiers in a check, without an account and only after ticking a consent box. ScamLens stores a keyed hash of each identifier, a masked version for display, the scam type and a keyed hash of the reporter's network address, never the chat. A report becomes public only when at least <!-- FACT:min_reporters -->2<!-- /FACT --> different networks reported the same identifier within <!-- FACT:report_retention_days -->90<!-- /FACT --> days. The owner of an identifier can contest an entry; it stays visible, labelled, until a person reviews it.

## Details

### Independence rule
- Plain words: two reports count as independent only if they came from different networks.
- SQL terms: `reported_counts` / `reported_counts_v2` count `distinct reporter_fingerprint_hash` per `identifier_hash` where `created_at > now() - interval '90 days'`, and return only rows with at least 2. `submit_report` enforces the daily cap (distinct submissions per fingerprint in the last day) and, for a repeat report of the same identifier by the same fingerprint, updates that row (`on conflict (identifier_hash, reporter_fingerprint_hash) do update`) instead of adding one, so one network always counts once.

### Fingerprints and hashing
- Fingerprint = HMAC-SHA256(`REPORT_HASH_PEPPER`, "fp:" + client IP). The IP is never stored. The User-Agent is not part of it (it let one person mint new "independent" reporters by switching browsers).
- Identifier hash = HMAC-SHA256(pepper, "id:" + type + ":" + canonical value). Phone numbers are low-entropy, so a plain hash could be brute-forced; the pepper prevents that.
- Graph edges store a shorter pseudonymous `reporter_key` (SHA-256 of the fingerprint, 16 hex characters) so graph links can require two different reporters without copying the fingerprint.

### 7-day check total (finish round H5)
- `GET /api/usage-stats` returns one number: the sum of the per-network `fp:<hash>:check` counters in `usage_counters` for today and the 6 days before (UTC), plus `days` and `asOf`. Denied calls were never counted, so it is checks that ran. The keys are read on the server only (`Db.usageRowsSince`, kept apart from the graph sync's `EXPORTABLE` tables) and never returned. Cached 5 minutes in memory and at the edge; 404 without a database or on a failed read.
- /about shows it under "Privacy: what is stored": "Checks run in the last 7 days: N (includes our own testing). ScamLens does not track who runs them." The number includes our own test and smoke runs.
- No migration: the server's service-role client already reads the table (RLS blocks only anon and authenticated).

### Contributed cases and feedback (final round P3, migration 004)
- `submit_case` calls `submit_report` (same reports, same co_reported links, same daily cap) and adds one `cases` row: category, channel, loss band, server-computed month, rule ids (validated against `RULES`), `synthetic`, the optional excerpt and the delete-code HMAC. The excerpt is redacted by `redactExcerpt` in the browser (the person sees the exact text) and again on the server; it is stored only with a second tick.
- `delete_case_by_code` deletes the case (and so the excerpt); with "also remove my reports" it also deletes the reports and graph edges of the same submission. TigerGraph copies of those edges stay until a moderator removes them (`docs/MODERATION.md` section 4).
- `submit_feedback` keeps one answer per network per identifier (`unique (identifier_hash, reporter_fingerprint_hash)`); a message without identifiers is keyed `rules:<sorted rule ids>`. `feedback_counts` returns counts and the reason codes of genuine answers, for display only.
- `case_trail_summary` returns counts by category, channel, loss band and month for identifiers that already have 2 independent reporters, with synthetic and real cases counted apart; never excerpts, fingerprints or case ids.
- `case_trail_cluster` returns the same counts for a whole scam trail, each case once (used by the check's scam trail).
- `purge_expired_cases()` (monthly): expired cases, excerpts whose reports were removed, feedback older than 90 days.
- Before the migration the routes answer 503 "Contributing is not available right now." and reads return nothing; checks are unaffected.
- Routes: `POST /api/case` (returns the delete code once), `POST /api/case/delete`, `POST /api/feedback`; zod, body caps, own daily limits, no input echo. A test scans every response and the logger for the excerpt.

### Masking
`maskIdentifier`: UPI and email keep 2 characters, the last one and the domain (`zz***d@okdemo`); phones keep 2 and 2 digits (`+91 98******10`); wallets keep 6 and 4; Telegram keeps 2 and 2.

### Retention
- Reports expire after <!-- FACT:report_retention_days -->90<!-- /FACT --> days (`expires_at`).
- Usage counters are deleted after about 7 days.
- Contest reasons: deleted by `purge_old_contests()` (migration `web/db/migrations/003_contest_retention.sql`) once the contest is decided or <!-- FACT:contest_retention_days -->90<!-- /FACT --> days old. The moderator runs it monthly (`docs/MODERATION.md` section 5); the app never calls it. It never touches reports, so a label set by a purged pending contest stays until a person clears it or the reports expire.

### Contest policy
Contesting needs the full identifier (the person must know it). The reason (10 to 500 characters) is stored only for the moderator and never shown on the site. The entry stays visible, labelled "Contested, under review", and stops counting toward High. A moderator upholds (removes the reports) or dismisses (clears the label) using the SQL in `docs/MODERATION.md`. Each network can contest at most <!-- FACT:contests_per_day -->3<!-- /FACT --> entries per day.

### What is and is not stored
Your check is never stored. If you choose to contribute a case, we store structured facts and, only if you tick it, a redacted excerpt you reviewed, visible only to the moderator, deleted with your delete code or after 90 days. The full inventory is in [docs/PRIVACY.md](../PRIVACY.md).

| Stored | Not stored |
|---|---|
| identifier hash, masked display, type | the chat or any quote |
| scam category, created/expiry dates | the IP address |
| reporter fingerprint hash | names, accounts, the User-Agent |
| contest reason (moderator only) | screenshots and transcripts |
| daily usage counts per hashed network key | the identifiers in a check that was not reported |
| contributed case: category, channel, loss band, month, rule ids, delete-code hash | the delete code itself |
| optional redacted excerpt (moderator only, max 500) | any excerpt the person did not tick, or unredacted text |
| feedback: verdict, fixed reason codes, rule ids | free-text feedback |

Database objects (generated from `web/db/*.sql`):

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

## Where in the code

- `web/db/migrations/004_cases_and_feedback.sql`: cases, feedback and their functions.
- `web/src/lib/cases/`: `redact.ts`, `delete-code.ts`, `schema.ts`, `service.ts`, `routes.ts` (route bodies).
- `web/src/lib/privacy-copy.ts`: the storage promise.
- `web/src/lib/cases/client.ts`: the request bodies the result panels send (raw identifiers, counted rule ids, the excerpt only after both ticks, exactly as previewed).
- `web/src/app/privacy/page.tsx` and `web/src/components/DeleteCaseForm.tsx`: /privacy and "Delete a case".

- `web/src/lib/reports/service.ts`: submit, lookup, contest.
- `web/src/lib/reports/privacy.ts`: hashing and fingerprints.
- `web/src/lib/reports/mask.ts`: masking.
- `web/src/lib/reports/schema.ts`: request and response schemas.
- `web/db/schema.sql` and `web/db/migrations/`: tables and functions.
- `web/src/app/api/report/route.ts` and `web/src/app/api/report/contest/route.ts`: routes.
- `docs/MODERATION.md`: moderator SQL.

## How to change it safely

Change the SQL only through a new idempotent migration that works before and after it runs (see migration 002's fallback). Keep `MIN_INDEPENDENT_REPORTERS` and the SQL numbers equal (a test checks this). Never add a free-text field to reports.

## How it is tested

`web/src/lib/reports/reports.test.ts` runs the real SQL in PGlite: the 2-reporter rule, one fingerprint counts once, daily caps, expiry, contest labels, the old-schema fallback, and the moderator SQL copied verbatim from `docs/MODERATION.md`. It also checks, on the seeded graph, that every evidence path lists its links as node-id pairs that exist in the view (finish round H4; see [09-GRAPH.md](09-GRAPH.md)).

The PGlite suites run with an explicit 30 s test and hook timeout, because starting Postgres in WebAssembly takes about 8 s when several suites start at once (see [12-TESTING-AND-EVAL.md](12-TESTING-AND-EVAL.md)).

## Known limits

People sharing one network (an office, a college, some mobile carriers) count as one reporter; one person on several networks can count as several. Review of contests is manual.
