# Changelog

## In plain words

What changed, by day, in plain language. The "Notes" list is written by hand with each change; the commit summary at the bottom is rebuilt from `git log` by `npm run docs:generate`.

## Details

### Notes

#### 2026-10-30 (final quality round, branch final-quality)
- Knowledge base added in `docs/knowledge/` with generated tables and a docs check that runs in `npm test`.
- AI off made explicit: a new `off` status (no key) is no longer counted as an unavailable source; the Suspected tier says "Suspected signals come from fixed pattern rules only."; the screenshot control is replaced by "Screenshot reading is off. Paste the text instead." whenever no vision model is configured (same check as `/api/health` `vision`), and `/api/transcribe` returns that sentence; /about wording follows the same checks.
- TigerGraph re-run attempted: workspace does not auto-start; Postgres fallback confirmed through the app.
- Signed check receipts: Ed25519 receipts with masked identifiers, no quotes and an HMAC text digest; "Download signed receipt" and a receipt code in the evidence pack; /verify checks them in the browser (WebCrypto) or on the server; the public key is at /.well-known/scamlens-receipt-key.json; `/api/health` adds `receipts` (true/false).
- "I already paid": an ordered plan (1930 first, then the bank, cybercrime.gov.in, keep evidence, crypto details, no recovery fees, tell someone) with optional fields and a complaint draft built entirely in the browser.
- Coverage ledger: a "What was checked" section under the risk header lists every source with its status (checked, not applicable, unavailable, skipped (limit)) and date, plus "Not checked" lines, all built from the check result.
- Contest retention: migration 003 adds `purge_old_contests()`, which deletes contest reasons once decided or 90 days old (run monthly from MODERATION.md); /about says so.
- Eval: 6 synthetic cases added (j01-j03 decoy-warning scams, j04-j06 genuine warnings) for 80 in total; the old code on the 80 cases had FP 3 / FN 2, the new code FP 0 / FN 0.
- Conditional awareness: advice shaped "If someone says ..., it is a fraud call" (English and Hinglish) is now warning context, which removes the last eval false positive (v01); "If you do not pay ..." threats are no longer mistaken for advice.
- Warning context hardened: a sentence that asks the reader to send, pay, join, click... (not negated in the same clause) is never treated as a warning, so a protective word can no longer hide a scam request in the same sentence.

#### 2026-10-30 (Swiss UI round)
- Page now fills the window on a 12-column grid (31% to 92% of a 1920 px window); ten-colour palette; three-part risk meter; ruled tier rows; graph evidence paths in the alert colour; /about in two columns with paper bands; decorative 404.
- `/api/health` reports the deployed build.
- Fixed in the browser check: graph path colouring, print rule, split steps on /about, 44 px tap targets.

#### 2026-10-29 (round 2)
- CSP verified against the build output; contested reports stay visible and labelled; warning-context hits shown but not counted; minimalist redesign; 8 eval cases.

#### 2026-10-29 (round 1, F0-F8)
- Limits, safe logging, security headers, banned-words test; usage guard; screenshot input; /about; 26 eval cases; domain list probe; risk explanation and What to do now; health without secrets.

#### Earlier (M1-M6)
- Skeleton, identifier extractor, verified tier, signal rules and risk engine, reports and link graph, eval, evidence pack and README.

### Commit summary (generated, not compared by docs:check)
<!-- GENERATED:START commits -->
- **2026-10-30** (26 commits): feat(paid-mode): add an "i already paid" plan and a browser-only draft; feat(ledger): show what was checked and what was not on every result; feat(reports): delete contest reasons once decided or 90 days old; test(eval): add six decoy and warning cases and rerun the evaluation; fix(signals): treat "if someone says this, it is a fraud" as a warning; fix(signals): stop warning words hiding hits that ask the reader to pay; docs(ops): record that tigergraph did not wake and the fallback answered; feat(signals): say plainly that checks are rules only while ai is off; chore(docs): generate knowledge-base tables from code and fail on drift; docs(knowledge): add a knowledge base that explains every part of scamlens; docs(screens): add live screenshots after the swiss redesign deploy; docs(readme): describe the swiss design, palette rules and build check; feat(health): report the deployed build so the live site can be checked; docs(ui): rewrite the ui checklist for the swiss design; docs(screens): add after screenshots of the swiss layout; fix(ui): repair layout issues found in the browser check; docs(progress): record the component restyle evidence; style(about): lay out about and 404 on the grid with paper bands; style(ui): draw the link graph in black, grey and one alert path; style(ui): divide tier findings with light rules and plain notices; style(ui): restyle buttons, text box and inline forms; style(layout): use a 12-column grid that fills the window; test(style): enforce the swiss palette and add a wcag contrast test; style(ui): add the swiss palette as css variables and base type styles; docs(rules): write down the commit, permission, summary and push rules; docs(screens): add before screenshots of the narrow single column
- **2026-10-29** (29 commits): feat(G5): README, DEPLOY, SPEC and HUMAN_TASKS for round 2; final eval run; feat(G4): minimalist redesign - four-colour palette, system type scale, no boxes, grayscale graph, inline forms, 404, style-enforcement test; feat(G3): warning-context hits shown but not counted, narrower digital-arrest and lucky-draw rules, 8 new eval cases; feat(G2): contested reports stay visible and labelled, never count toward High; migration 002 with old-schema fallback; MODERATION.md; feat(G1): CSP verified against build output, directive test, check-headers script, plain-words trade-off; feat(F8): health statuses without secrets, smoke-live script, DEPLOY.md, README and SPEC final decisions; feat(F7): risk explanation, What to do now, visible notices, tier labels, focus and aria-live, print support, one demo label incl. graph; feat(F6): domain list probed and honestly skipped, chain support doc from live probes, working link on every verified row; feat(F5): 26 new synthetic eval cases, narrow FP fixes, obfuscation-aware rules, RESULTS.md with per-rule and identifier metrics; feat(F4): /about trust page from code constants, site footer, report-limit constant; feat(F3): screenshot input via /api/transcribe with rate limit, transcript confirmation UI, smoke script; feat(F2): usage store with daily per-fingerprint limits, global LLM cap, 429 before external calls, 2-chain Etherscan cap; feat(F1): limits, safe logger, security headers, banned-words test, reporter-independent graph links, IP-only fingerprint; feat(F0): audit findings, ReDoS timing script, progress log; Graph view: place node labels below the circles; Etherscan summary: don't say 'no transactions' for contracts or non-zero nonce; Graph view: visible link lines and node labels on dark theme; TigerGraph: treat only 'unknown vertex id' as no links; config errors now fall back to Postgres; TigerGraph verified live: queries compile and install, parity 19/19 with Postgres; TigerGraph: correct GSQL v2 queries, loader, live sync, parity-checked setup script; Etherscan free plan: skip BNB/Base, 2 req/s, retry on rate limit, 10-min cache; Fix empty numeric env vars disabling reports; demo sample 1 uses seeded UPI; M6: synthetic eval, evidence pack, demo samples, README; M5: reports (2-reporter rule, contest, rate limit, hub filter) + link graph; M4: signals engine (18 rules + validated AI pass) and risk rules; M3: verified tier (OFAC, ScamSniffer, GoPlus, Etherscan V2, TronGrid) + /api/check; M2: identifier extractor with checksum/format validation; M1: deployed skeleton (local checks pass); Step 0: add project spec (docs/SPEC.md)
<!-- GENERATED:END commits -->

## Where in the code

- `docs/PROGRESS.md`: detailed evidence per step.

## How to change it safely

Add a Notes line for every change to code mapped in `docs/knowledge/MANIFEST.json`, in the same commit; `npm run docs:check` fails otherwise.

## How it is tested

`web/scripts/docs-check.ts` (MANIFEST rule).

## Known limits

The commit summary is refreshed only when `npm run docs:generate` runs.
