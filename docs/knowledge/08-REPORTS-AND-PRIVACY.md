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

### Masking
`maskIdentifier`: UPI and email keep 2 characters, the last one and the domain (`zz***d@okdemo`); phones keep 2 and 2 digits (`+91 98******10`); wallets keep 6 and 4; Telegram keeps 2 and 2.

### Retention
- Reports expire after <!-- FACT:report_retention_days -->90<!-- /FACT --> days (`expires_at`).
- Usage counters are deleted after about 7 days.
- Contest reasons: deleted by `purge_old_contests()` (migration `web/db/migrations/003_contest_retention.sql`) once the contest is decided or <!-- FACT:contest_retention_days -->90<!-- /FACT --> days old. The moderator runs it monthly (`docs/MODERATION.md` section 5); the app never calls it. It never touches reports, so a label set by a purged pending contest stays until a person clears it or the reports expire.

### Contest policy
Contesting needs the full identifier (the person must know it). The reason (10 to 500 characters) is stored only for the moderator and never shown on the site. The entry stays visible, labelled "Contested, under review", and stops counting toward High. A moderator upholds (removes the reports) or dismisses (clears the label) using the SQL in `docs/MODERATION.md`. Each network can contest at most <!-- FACT:contests_per_day -->3<!-- /FACT --> entries per day.

### What is and is not stored
| Stored | Not stored |
|---|---|
| identifier hash, masked display, type | the chat or any quote |
| scam category, created/expiry dates | the IP address |
| reporter fingerprint hash | names, accounts, the User-Agent |
| contest reason (moderator only) | screenshots and transcripts |
| daily usage counts per hashed network key | the identifiers in a check that was not reported |

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
<!-- GENERATED:END db -->

## Where in the code

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

`web/src/lib/reports/reports.test.ts` runs the real SQL in PGlite: the 2-reporter rule, one fingerprint counts once, daily caps, expiry, contest labels, the old-schema fallback, and the moderator SQL copied verbatim from `docs/MODERATION.md`.

## Known limits

People sharing one network (an office, a college, some mobile carriers) count as one reporter; one person on several networks can count as several. Review of contests is manual.
