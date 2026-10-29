# Distinctive features

## In plain words

Four features that set ScamLens apart from list-only checkers: a coverage ledger that says exactly what was and was not checked; an "I already paid" plan with a complaint draft built in the browser; a signed receipt anyone can verify; and a public pattern library generated from the same rules the engine uses. Each is described here once it is built (step J5 of the final round).

## Details

| Feature | Status |
|---|---|
| Coverage ledger ("What was checked") | not built yet |
| "I already paid" mode | not built yet |
| Signed check receipt and /verify | not built yet |
| Pattern library (/patterns) | not built yet |

## Where in the code

- `web/src/components/`: the UI parts (added in J5).

## How to change it safely

Use only the Swiss tokens; keep every feature driven by real run data or by `rules.ts`, never by hand-typed per-run text.

## How it is tested

Each feature gets its own tests in J5.

## Known limits

UNKNOWN until built.
