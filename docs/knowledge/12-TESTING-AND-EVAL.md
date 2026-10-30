# Testing and evaluation

## In plain words

Every change must pass the unit tests, the type checker, the linter, a production build and the docs check. Database code is tested against real Postgres SQL running inside the test (PGlite). The pattern rules are also measured on <!-- FACT:eval_cases -->80<!-- /FACT --> hand-written synthetic chats; that "eval" tells us how the rules behave on examples we wrote, not how they behave on real scams in the wild.

## Details

### Test inventory (generated)
<!-- GENERATED:START tests -->
| test file | it / it.each declarations |
|---|---|
| `web/src/lib/about.test.ts` | 7 |
| `web/src/lib/complaint-draft.test.ts` | 4 |
| `web/src/lib/contrast.test.ts` | 8 |
| `web/src/lib/coverage.test.ts` | 6 |
| `web/src/lib/docs.test.ts` | 4 |
| `web/src/lib/eval-data.test.ts` | 7 |
| `web/src/lib/evidence-pack.test.ts` | 4 |
| `web/src/lib/f1-safety.test.ts` | 19 |
| `web/src/lib/graph/drawing.test.ts` | 2 |
| `web/src/lib/graph/migrations.test.ts` | 6 |
| `web/src/lib/graph/tigergraph.test.ts` | 15 |
| `web/src/lib/health.test.ts` | 6 |
| `web/src/lib/identifiers.test.ts` | 30 |
| `web/src/lib/launch.test.ts` | 4 |
| `web/src/lib/patterns.test.ts` | 6 |
| `web/src/lib/receipts.test.ts` | 14 |
| `web/src/lib/reports/reports.test.ts` | 28 |
| `web/src/lib/reports/retention.test.ts` | 6 |
| `web/src/lib/risk.test.ts` | 17 |
| `web/src/lib/signals/context.test.ts` | 20 |
| `web/src/lib/signals/signals.test.ts` | 21 |
| `web/src/lib/style.test.ts` | 11 |
| `web/src/lib/transcribe.test.ts` | 17 |
| `web/src/lib/ui.test.ts` | 40 |
| `web/src/lib/usage.test.ts` | 18 |
| `web/src/lib/verified/verified.test.ts` | 30 |
<!-- GENERATED:END tests -->

### Commands (from `web/`)
| Command | What it does |
|---|---|
| `npm test` | Vitest: unit, SQL (PGlite), render and docs tests |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run docs:check` | Knowledge base in sync with the code |
| `npm run eval` | Synthetic evaluation, writes `eval/RESULTS.md` |
| `npx tsx scripts/smoke-live.ts <url>` | The three samples end to end against a running site |
| `npx tsx scripts/check-headers.ts <url>` | Security headers on `/`, `/about`, `/api/health` |
| `npx tsx scripts/redos-check.ts` | Regex timing on adversarial inputs |

### Evaluation
- Method: `eval/run.ts` runs the same rule pass and warning-context logic as the risk card on every case in `eval/chats.json` and counts a chat as "flagged" when at least one counted rule fires. A case's label (scam or normal) and its expected rules are written by hand. All cases are synthetic and many normal cases are deliberately tricky (bank advisories, exchange notices, a friend asking for a UPI payment).
- AI mode: not run, and no model calls were made in the final round. The optional AI helper is switched off by the owner's decision, so only the rules are measured. Its code paths are tested with mocked completers (`web/src/lib/signals/signals.test.ts`, `web/src/lib/transcribe.test.ts`); "AI off" states are tested in `web/src/lib/ui.test.ts`.

Current results (generated from `eval/RESULTS.md`):

<!-- GENERATED:START eval -->
| metric (rules only) | value |
|---|---|
| cases | 80 |
| accuracy | 100.0% |
| precision | 100.0% |
| recall | 100.0% |
| false positives | 0 |
| false negatives | 0 |
| false positive cases | none |
| run date | 2026-10-29T20:12:17.444Z |
| commit | 6babc79 (with uncommitted changes) |
<!-- GENERATED:END eval -->

### What the eval is NOT
- Not a measure of real-world accuracy: the cases were written by the team.
- Not a measure of the Verified or Reported tiers.
- Not a benchmark against other tools.

## Where in the code

- `web/src/lib/`: unit tests next to the code (`*.test.ts`).
- `web/src/test-support/pglite.ts`: local Postgres for tests.
- `web/src/lib/docs.test.ts`: the docs check inside `npm test`.
- `eval/chats.json`, `eval/run.ts`, `eval/RESULTS.md`: the eval.
- `web/scripts/`: live and timing scripts.

## How to change it safely

Never weaken or delete a test to make a change pass; fix the code, or show why the test is wrong. Add eval cases without editing existing ones and regenerate `eval/RESULTS.md` with `npm run eval`.

## How it is tested

The tests test themselves where it matters: the style scanner and the docs checker each have a test that a deliberate violation is caught.

## Known limits

PGlite suites used to time out now and then (up to 6 of them in one run): each `localDb()` starts Postgres in WebAssembly, about 1 s alone but about 8 s when six start in parallel under vitest's workers, past the default 5 s limit. Since the TigerGraph finish round the 8 PGlite suites set `vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })`; no assertion was relaxed, and four full runs in a row passed. Click-only states (offline error, waking graph, open report form) are covered by browser runs, not unit tests.
