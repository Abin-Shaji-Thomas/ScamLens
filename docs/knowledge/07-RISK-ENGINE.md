# Risk engine

## In plain words

The risk level is decided by a few lines of fixed code, not by AI. One verified match, or a community report together with a warning sign in the text, gives **High**. Any warning sign or report on its own gives **Elevated**. Nothing found gives **Low signals**, which always comes with "This does not mean safe". The level is shown as a word, as the bold underlined position in "Low signals · Elevated · High", and as a meter with 1, 2 or 3 filled segments, so colour is never needed.

## Details

| Inputs | Level |
|---|---|
| verified matches >= 1 | High |
| reported (non-contested) identifiers >= 1 AND counted suspected rules >= 1 | High |
| counted suspected rules >= 1, or reported identifiers >= 1, or contested identifiers >= 1 | Elevated |
| none of the above | Low signals |

Definitions:
- *verified match*: a Verified row with status `match` (OFAC, ScamSniffer, or a GoPlus flag).
- *reported identifier*: at least <!-- FACT:min_reporters -->2<!-- /FACT --> distinct reporter fingerprints within <!-- FACT:report_retention_days -->90<!-- /FACT --> days, not contested.
- *counted suspected rules*: distinct rule ids among suspected signals that are not in warning context.

Effects:
- **Contested reports** stay visible, labelled "Contested, under review", and can raise Low to Elevated at most; they never count toward High.
- **Warning context**: a sentence that also asks the reader to send, pay, join, click... is never warning context (final round), and conditional advice ("If someone says ..., it is a fraud call") is. Hits only inside warning or news-style sentences add the reason "pattern(s) appear only in warning or news-style text ... so they are shown but not counted" and do not raise the level.
- **Unavailable sources** add "source(s) unavailable - result is incomplete" and never lower the level.
- **No reports**: when the reports database answered and found nothing, `reportedMessage` = "No known reports. This does not mean safe."; when the database is down, that message is not shown (the card says "unavailable" instead).

Invariants (each proved by a test):
1. Suspected signals alone, any number, AI or rules, never produce High.
2. A contested report never contributes to High.
3. "No known reports" is never claimed when the reports database is unavailable.

## Where in the code

- `web/src/lib/risk.ts`: `assessRisk`, labels and explanations.
- `web/src/lib/check.ts`: how the inputs are counted.
- `web/src/components/RiskBadge.tsx`: word, scale and meter.

## How to change it safely

Any change here changes the product's promise. Keep the invariants above; add a test per new branch; update this table and `docs/SPEC.md`.

## How it is tested

`web/src/lib/risk.test.ts` (one test per branch, AI-only never High, contested never High), `web/src/lib/reports/reports.test.ts` (end to end: two reports plus scam text is High, after a contest Elevated), `web/src/lib/ui.test.ts` (meter segments per level).

## Known limits

The engine counts distinct rules, not their strength; all rules weigh the same.
