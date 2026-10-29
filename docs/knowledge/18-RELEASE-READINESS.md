# Release readiness

## In plain words

The final quality gate: every scenario, failure, privacy, performance and browser check run before the last push, with PASS, FAIL or UNKNOWN and the evidence. Filled in by step J6 of the final round.

## Details

Status: not yet run (J6 pending). Every row below is UNKNOWN until then.

| Area | Result | Evidence |
|---|---|---|
| Scenarios through the real check path | UNKNOWN | – |
| Failure injection | UNKNOWN | – |
| Privacy audit | UNKNOWN | – |
| Performance | UNKNOWN | – |
| Browser at 5 widths | UNKNOWN | – |
| Tests, typecheck, lint, build, docs:check, eval | UNKNOWN | – |

## Where in the code

- `docs/PROGRESS.md`: raw evidence.
- `docs/screens/`: screenshots.

## How to change it safely

Re-run the affected check after every fix and update its row with the real output line.

## How it is tested

By the gate itself.

## Known limits

Hover, screen reader and real-device checks need a person.
