# Known gaps and roadmap

## In plain words

What ScamLens cannot do yet, ranked by how much it matters, and what could come next. Gaps are updated by each round; anything not verified is marked UNKNOWN.

## Details

### Gaps (as of the start of the final round, 2026-10-30)
| Severity | Gap | Where |
|---|---|---|
| HIGH | A warning word can hide a solicitation in the same sentence ("Beware of fake sites, send 5000 USDT now...") | `web/src/lib/signals/context.ts` (fixed in J3) |
| MED | One eval false positive: a bank advisory phrased "If someone says ..., it is a fraud call" | `eval/RESULTS.md` (addressed in J3) |
| MED | Contest reasons are kept with no retention limit | `web/db/migrations/002_contest_policy.sql` (fixed in J4) |
| MED | Screenshot upload is offered even though no vision key exists | `web/src/components/CheckForm.tsx` (fixed in J2) |
| MED | Whether the live Supabase has migration 002 applied: UNKNOWN | `docs/HUMAN_TASKS.md` |
| MED | Which graph backend answers live: UNKNOWN until `tg-setup` is re-run | `web/scripts/tg-setup.ts` (J2) |
| LOW | Windows renders headings at weight 400 (Helvetica is aliased to Arial) | `web/src/app/globals.css` |
| LOW | Graph drawing is small inside a large canvas | `web/src/components/GraphPanel.tsx` |
| LOW | First smoke run after a deploy can time out (cold start) | `web/scripts/smoke-live.ts` |
| LOW | UPI, phone and Telegram identifiers have no verified source (by nature) | `web/src/lib/verified/index.ts` |

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
