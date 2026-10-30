# Known gaps and roadmap

## In plain words

What ScamLens cannot do yet, ranked by how much it matters, and what could come next. Gaps are updated by each round; anything not verified is marked UNKNOWN.

## Details

### Gaps (as of the start of the final round, 2026-10-30)
| Severity | Gap | Where |
|---|---|---|
| FIXED | A warning word could hide a solicitation in the same sentence (fixed in J3, commit fix(signals)) | `web/src/lib/signals/context.ts` |
| FIXED | Eval false positive v01, a bank advisory "If someone says ..., it is a fraud call" (fixed in J3 with a general conditional-awareness marker) | `web/src/lib/signals/context.ts` |
| LOW | Solicitation detection is verb-list based: a request phrased without those verbs ("the fee is due tonight") does not defeat a marker in the same sentence | `web/src/lib/signals/context.ts` |
| FIXED | Contest reasons had no retention limit (fixed in J4 with migration 003 and a monthly purge; until a person runs them, reasons are kept as before) | `web/db/migrations/003_contest_retention.sql` |
| MED | Screenshot upload was offered with no vision key (fixed in J2: hidden, driven by the health check's `vision` flag) | `web/src/components/CheckForm.tsx` |
| MED | Whether the live Supabase has migration 002 applied: UNKNOWN | `docs/HUMAN_TASKS.md` |
| LOW | TigerGraph setup done (19/19 SAME, 2026-10-30), but Savanna has no auto-start: an idle workspace suspends and the graph answers from Postgres (labelled) until a person resumes it | `docs/HUMAN_TASKS.md` item 3 |
| DESIGN | Headings are regular-weight Arial on every OS (finish round); the earlier thin Segoe UI Light headings on Windows were removed on purpose | `web/src/app/globals.css` |
| LOW | Graph drawing is small inside a large canvas | `web/src/components/GraphPanel.tsx` |
| FIXED | First smoke run after a deploy could time out (cold start); smoke-live now warms up first | `web/scripts/smoke-live.ts` |
| LOW | UPI, phone and Telegram identifiers have no verified source (by nature) | `web/src/lib/verified/index.ts` |
| LOW | Website domains are checked against one list only (GoPlus phishing sites, live); ScamSniffer's domain list is too large to load. Domain check built in the finish round after a probe showed GoPlus answers 1 for a known phishing domain | `web/src/lib/verified/goplus.ts` |

| FIXED | Flaky PGlite tests under parallel load (explicit 30 s timeouts on the 8 PGlite suites, TigerGraph finish round) | `web/src/test-support/pglite.ts` |

### Roadmap (not built)
- Partnerships for verified UPI and phone data (bank or NPCI feeds), if they ever become available.
- More Hinglish and regional-language patterns, with eval cases for each.
- A moderator screen instead of SQL for contests.
- Optional AI helper, if the owner adds a key: run the eval in both modes and publish the comparison before claiming any benefit.

## Where in the code

- `docs/HUMAN_TASKS.md`: what needs a person.
- `docs/PROGRESS.md`: what each round verified.

## How to change it safely

When a gap is fixed, move it to the changelog with the commit, and say how it was verified.

## How it is tested

Each fixed gap gets a regression test named in the step's evidence table in `docs/PROGRESS.md`.

## Known limits

This list is only as complete as the last audit.
