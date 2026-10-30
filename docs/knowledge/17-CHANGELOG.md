# Changelog

## In plain words

What changed, by day, in plain language. The "Notes" list is written by hand with each change; the commit summary at the bottom is rebuilt from `git log` by `npm run docs:generate`.

## Details

### Notes

#### 2026-10-30 (finish round, branch finish)
- Typography: Arial-first stack (Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto), headings and numerals at weight 400, no light weight, `font-synthesis: none`; production now matches the owner's earlier localhost look on every OS (measured: 0 differences across 75 values at 375-1920 px).

#### 2026-10-30 (TigerGraph finish round, branch tg-finish)
- Released: 89ad467..76767c7 pushed; live build matched, smoke-live `ALL PASS (39 expectations)` after the warm-up, headers `ALL PASS (48 checks)`, live graph answered by TigerGraph (609-654 ms), hint, ledger row and /about counts verified in the browser.
- Docs sweep: HUMAN_TASKS rewritten to the real state (migrations done, TigerGraph setup done, routine and person-only checks), DEPLOY lists USAGE_VERIFY_PER_DAY, RECEIPT_SIGNING_KEY, NEXT_PUBLIC_SITE_URL and migration 003, UI_CHECKLIST rows 31-38 for the new pieces, SPEC decision section appended.
- smoke-live warms up (health poll, then one check with a 60 s timeout and one retry) before its expectations.
- Pinned by tests: the report form is never offered on the three synthetic samples (it is offered for the same text typed by a person).
- Font order: "Helvetica Neue", "Segoe UI", Roboto, Helvetica, Arial, so Windows uses Segoe UI Light for the light headings (measured; no overflow at 375-1920 px).
- Docs: `"graph":"tigergraph"` in /api/health is documented as configured, not awake.
- /about "Link graph" section with live counts from `GET /api/graph/stats` (TigerGraph built-in statistics, Postgres fallback, 5-minute cache, graph limit, omitted on failure).
- Linked-identifier hints: up to 3 reported identifiers get a background graph lookup and one plain sentence when links exist, with the not-proof note; failures show nothing.
- Coverage ledger: a "Link graph" row (not looked up / checked with backend and ms / unavailable / not applicable); receipts unchanged.
- Graph timing: `/api/graph` returns optional `elapsedMs`; the note reads "Graph backend: tigergraph (N ms)" (the fallback label is unchanged).
- Graph drawing: the graph now zooms to fit its canvas (40 px padding) when the layout settles and after a resize, the canvas is 300 px on phones and 360-480 px otherwise, and labels sit below each node on a white halo; colours unchanged.
- Q2 checked on the demo data: 4 of 7 demo wallets have a path to a flagged demo address (TigerGraph and Postgres agree); tg-setup now prints how many cases return rows instead of only the first case.
- tg-setup honest about migrations: it reads the schema, skips migration 001 when `Report.reporter_key` exists, and otherwise stops with "HUMAN STEP REQUIRED" and the GSQL (no more "Access Denied" from a global change with the graph token); the migration file now matches what the owner ran; TigerGraph errors include the masked response detail; install retries a dropped connection. Live: `19/19 queries SAME`.
- Flaky PGlite tests fixed: the cause was Postgres-in-WebAssembly start-up under parallel load (about 8 s for six at once); the 8 PGlite suites now have explicit 30 s timeouts.

#### 2026-10-30 (final quality round, branch final-quality)
- Knowledge base added in `docs/knowledge/` with generated tables and a docs check that runs in `npm test`.
- AI off made explicit: a new `off` status (no key) is no longer counted as an unavailable source; the Suspected tier says "Suspected signals come from fixed pattern rules only."; the screenshot control is replaced by "Screenshot reading is off. Paste the text instead." whenever no vision model is configured (same check as `/api/health` `vision`), and `/api/transcribe` returns that sentence; /about wording follows the same checks.
- TigerGraph re-run attempted: workspace does not auto-start; Postgres fallback confirmed through the app.
- Released: pushed f201b16 to main; live build, smoke-live (39), headers (48) and a live browser run all passed.
- Launch kit (docs/knowledge/20) with X, LinkedIn and WhatsApp drafts and a 30-second script; demo scripts in 14 rewritten from the release-gate outputs.
- Share preview: Open Graph and Twitter large-card metadata, a generated 1200x630 share image (white, black rule, wordmark, one line; palette colours only, no web fonts) and a monochrome lens icon; optional NEXT_PUBLIC_SITE_URL sets absolute image URLs.
- Fixed in the release gate: the /verify link in the evidence-pack line now has a 44 px tap area.
- Pattern library: /patterns explains all 18 rules (what it looks like, why, what to do, an illustrative example, when it is not a signal, how it counts), generated from rules.ts; each Suspected finding and the footer link to it.
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
- **2026-10-30** (48 commits): docs(release): record the live check of the tigergraph finish round; docs(docs): bring every doc up to date with the tigergraph finish round; chore(scripts): warm the live site up before the smoke expectations; test(ui): pin that the report form is hidden on the synthetic samples; style(ui): put segoe ui before helvetica so windows gets light headings; docs(health): say that graph tigergraph in health means configured; feat(about): add a link graph section with live graph counts; feat(graph): hint when a reported identifier links to others; feat(ledger): add a link graph row that follows the graph lookup; feat(graph): show how long the graph backend took under the graph; fix(graph): zoom the link graph to fit its canvas with readable labels; fix(graph): report how many cases return rows in the parity output; fix(graph): check the schema instead of sending the global migration; test(reports): give the pglite suites explicit timeouts to stop flakes; docs(rules): allow graph-scoped tigergraph setup, never global changes; docs(release): record the live verification of the final round; docs(launch): write the launch posts and demo scripts from real runs; feat(launch): add share preview metadata, a share image and an icon; docs(release): record the final quality gate and its screenshots; fix(ui): give the /verify link in the evidence pack a 44px tap area; feat(patterns): publish a pattern library generated from the rules; feat(receipts): sign every check and let anyone verify it at /verify; feat(paid-mode): add an "i already paid" plan and a browser-only draft; feat(ledger): show what was checked and what was not on every result; feat(reports): delete contest reasons once decided or 90 days old; test(eval): add six decoy and warning cases and rerun the evaluation; fix(signals): treat "if someone says this, it is a fraud" as a warning; fix(signals): stop warning words hiding hits that ask the reader to pay; docs(ops): record that tigergraph did not wake and the fallback answered; feat(signals): say plainly that checks are rules only while ai is off; chore(docs): generate knowledge-base tables from code and fail on drift; docs(knowledge): add a knowledge base that explains every part of scamlens; docs(screens): add live screenshots after the swiss redesign deploy; docs(readme): describe the swiss design, palette rules and build check; feat(health): report the deployed build so the live site can be checked; docs(ui): rewrite the ui checklist for the swiss design; docs(screens): add after screenshots of the swiss layout; fix(ui): repair layout issues found in the browser check; docs(progress): record the component restyle evidence; style(about): lay out about and 404 on the grid with paper bands; style(ui): draw the link graph in black, grey and one alert path; style(ui): divide tier findings with light rules and plain notices; style(ui): restyle buttons, text box and inline forms; style(layout): use a 12-column grid that fills the window; test(style): enforce the swiss palette and add a wcag contrast test; style(ui): add the swiss palette as css variables and base type styles; docs(rules): write down the commit, permission, summary and push rules; docs(screens): add before screenshots of the narrow single column
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
