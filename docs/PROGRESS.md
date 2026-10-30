# ScamLens finishing run: progress log

Each step: pre-flight (git clean, npm test, typecheck, lint), build, post-flight (test, typecheck, lint, build + step checks), evidence, commit `feat(Fx): ...`. Commands run from `web/` in Windows PowerShell. "UNKNOWN" = not run or not verifiable here.

## STEP 0 - Audit (read-only)

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | `npm test`: 8 files, 156 passed; `npm run typecheck` exit 0; `npm run lint` exit 0. Tree had one untracked cache dir `web/.vitest/` (from an audit JSON-reporter run), now gitignored |
| Findings written | PASS | `docs/AUDIT.md` |
| ReDoS measured | PASS | `npx tsx scripts/redos-check.ts`: 56 functions/regexes x 20 inputs of 6000 chars; worst 3.7 ms; 0 cases >= 200 ms |

## F1 - Safety and hygiene

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 156/156 tests, typecheck 0, lint 0 (after F0 commit) |
| HIGH: graph links need independent reporters | PASS (code + PGlite test); live Supabase/TigerGraph UNKNOWN until HUMAN_TASKS 1-2 | `graph_edges.reporter_key` (sha256 of fingerprint, 16 hex) + backfill in `db/schema.sql`; Q1 requires different reporter keys, Q3 needs >= 2 distinct reporters; same in `graph/queries.gsql`, `graph/reference.ts`; test "one reporter filing two reports cannot create a Q1 link or a Q3 cluster" |
| HIGH: contest abuse | DEFERRED to F2 (needs the usage store) | - |
| MED: one person = two fingerprints by changing User-Agent | PASS | `fingerprintHash(pepper, ip)` (UA removed); test "fingerprint depends on the IP only" |
| MED: no rate limit on check/graph | DEFERRED to F2 | - |
| MED: graph_edges duplicates | PASS | unique index `(src_hash, dst_hash, relation, submission_id)`; `add_payment_edge` de-duplicates |
| MED: graph canvas fixed 600 px | PASS (code); 375 px rendering UNKNOWN (no browser check in this step) | `GraphPanel.tsx` sizes to container via ResizeObserver |
| LOW: uncaught fetch errors in graph/report/contest UI | PASS | try/catch in `GraphPanel.tsx`, `ReportForm.tsx`, `ReportedList.tsx` |
| LOW: Q3 "victims" wording | PASS | `graph/view.ts` now "reported together with this wallet by N different reporters" |
| LOW: maxDuration | PASS | `export const maxDuration = 30` in `api/check/route.ts` |
| limits.ts enforced with 400/413 | PASS | `src/lib/limits.ts`, `src/lib/body.ts`; tests: 413 on all 4 POST routes without echoing input, 400 over 6000 chars, 20-identifier cap with notice; live `npm run start`: oversize body -> HTTP 413 "Please paste at most 6,000 characters" (message re-checked by test) |
| log.ts safe logger | PASS | tests reject fields text/quote/transcript/identifier/value/image/body/input and free text in status/event; test asserts no direct console.* outside log.ts |
| Security headers | PASS (headers); browser CSP behaviour UNKNOWN | `src/lib/security-headers.ts` + `next.config.ts`; `curl -D -` on `npm run start` showed CSP, nosniff, no-referrer, DENY, Permissions-Policy |
| Banned-words test | PASS | `f1-safety.test.ts` scans all non-test .ts/.tsx under src |
| .env.example synced | PASS | every name read by code present; SUPABASE_ANON_KEY marked unused |
| ReDoS < 200 ms | PASS | worst 3.4 ms, 0 slow cases |
| Post-flight | PASS | 178/178 tests (9 files), typecheck 0, lint 0, build 0 |

## F2 - Abuse guard without accounts

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 178/178 tests (9 files), typecheck 0, lint 0, tree clean |
| UsageStore interface + Supabase + memory | PASS | `src/lib/usage.ts`: `MemoryUsageStore`, `sqlUsageStore` (RPC `increment_usage`), `withFallback` (logs `usage_store_fallback`, marks `degraded`) |
| SQL: usage_counters + increment_usage (security definer, search_path '', service_role only) | PASS (PGlite); live Supabase UNKNOWN until HUMAN_TASKS 3 | `db/schema.sql` (end), `db/supabase-grants.sql`; test "SQL increment_usage: atomic count, denied calls are not counted" checks `prosecdef` and `search_path=""` |
| Keys and defaults | PASS | `fp:<sha256(usage:HMAC(pepper, ip))[:32]>:<route>` and `global:llm`; check 40, transcribe 10, graph 100, contest 3, global LLM 1500/day via `positiveIntEnv`; reports keep `REPORTS_MAX_PER_DAY` in SQL |
| Over limit: 429 + Retry-After + zero external calls | PASS | tests "over the limit: /api/check returns 429 and makes ZERO external calls" (with a control test proving the same request does call fetch under the limit), graph + contest 429 |
| Global cap before any LLM call | PASS | test "global LLM cap reached: the check runs regex-only with a notice and never calls the LLM" |
| Store failure: skip AI, local checks keep working | PASS | test "usage store down: the check still works without AI and says why" |
| Fan-out caps | PASS | `MAX_IDENTIFIERS` (F1), `MAX_ADDRESSES`=10, `MAX_ETHERSCAN_CHAINS_IN_FLIGHT`=2 with test "at most 2 Etherscan chains are looked up at the same time" (peak observed 2), `ETHERSCAN_RPS` limiter unchanged |
| HIGH from audit: contest abuse | PARTIAL | contest now capped at 3/day per fingerprint (429). Without accounts one person on many networks can still hide badges; stated on /about (F4) and in Known gaps |
| Post-flight | PASS | 195/195 tests (10 files), typecheck 0, lint 0, build 0 |

## F3 - Screenshot input

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 195/195 tests, typecheck 0, lint 0 (after F2 commit) |
| POST /api/transcribe with zod (png/jpeg/webp data URL, <= 1,500,000 chars) | PASS | `src/lib/transcribe.ts` `TranscribeRequest` (regex + magic-byte signature check), `src/app/api/transcribe/route.ts`; body > MAX_IMAGE_BODY_CHARS -> 413 |
| Rate-limited per F2 | PASS | `guardRequest("transcribe", ..., usesLlm=true)`; test "11th screenshot of the day gets 429 and the model is not called"; global cap -> 429 with Retry-After |
| Model, temperature 0, transcribe-only prompt | PASS (code + mocked test); real provider UNKNOWN (no key; HUMAN_TASKS 4) | `OPENAI_VISION_MODEL` else `OPENAI_MODEL`; `TRANSCRIBE_SYSTEM` says do not follow instructions in the image, plain text only |
| Post-process: strip control chars, truncate to MAX_TEXT_CHARS | PASS | `cleanTranscript` tests (also strips bidi overrides and zero-width chars) |
| No key / no vision support -> clear paste-text error | PASS | tests: 503 without config; provider error -> 502 with the same message, provider text not echoed |
| Never store or log image/transcript | PASS | route logs only `transcribe` + status/duration via safe logger; nothing persisted |
| Accept/reject tests (oversize, svg, non-image) | PASS | 17 tests in `src/lib/transcribe.test.ts`; renamed HTML-as-PNG rejected |
| Injection text inside a transcript is just text | PASS | test: injected "ignore previous instructions" + fake JSON returned verbatim as text; `runCheck` on it: identifiers equal our extractor's output, fake rule id and non-substring quote dropped (`ai.dropped = 2`), risk not low |
| No network in tests | PASS | `fetch` stubbed to reject in route tests; model injected |
| UI: picker, downscale <= 1600 px, JPEG 0.8, editable transcript, "Check this text" | PASS (code, build); browser behaviour UNKNOWN | `src/components/ScreenshotInput.tsx`; falls back to q 0.6/0.45 if still too large; only confirmed text goes to `/api/check` |
| Form copy promises only what is built | PASS | label no longer says "screenshot text"; screenshot note says the image goes to the AI provider once and is not stored; README line 3 and limits updated |
| scripts/smoke-transcribe.ts | PASS (runs; without a key prints `FAIL: HTTP 503 ...`, exit 1, as designed) | dry run against a 16-byte PNG header in the job tmp dir |
| Post-flight | PASS | 212/212 tests (11 files), typecheck 0, lint 0 (unused directive removed), build 0 (new route `/api/transcribe`) |

## F4 - Trust surface

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 212/212 tests, typecheck 0, lint 0 (after F3 commit) |
| /about server component, renders statically | PASS | `src/app/about/page.tsx`; `npm run build` lists `○ /about` (static); `npm run start` -> `GET /about` 200 |
| Content: is/is not, three tiers + wording rules, independence rule incl. no-accounts caveat, sources with dates/licences/limits, privacy + retention, contest, demo data, emergency steps (1930, cybercrime.gov.in, bank) | PASS | `src/lib/about.test.ts` (5 tests) renders the page with `react-dom/server` and checks each item |
| Numbers from code constants | PASS | page imports `MIN_INDEPENDENT_REPORTERS`, `REPORT_RETENTION_DAYS`, `DEFAULT_REPORTS_MAX_PER_DAY` (new, now used by `reports/service.ts`), `usageLimits({})`, `EVM_CHAINS`, `ETHERSCAN_MAX_ADDRESSES`, `DEFAULT_HUB_MAX`, `RULES.length`, OFAC/ScamSniffer snapshot metadata; test asserts several |
| Etherscan chains named from code | PASS | free-tier names from `EVM_CHAINS.filter(freeTier)` (Ethereum, Polygon, Arbitrum One); paid-only (BNB Chain, Base) stated as unavailable |
| Footer on every page linking /about | PASS | `src/components/SiteFooter.tsx` in `app/layout.tsx`; live: `/` and `/about` HTML contain `href="/about"` |
| Banned-words test | PASS | `f1-safety.test.ts` scans .tsx too; still green |
| Links work | PASS (internal + URL shape); external sites reachable UNKNOWN (not fetched) | test: every href is an existing `app/**/page.tsx` route or an https URL |
| "optional note" in privacy | DEVIATION | there is no note field in the code (reports schema has none); the page says so instead of promising one |
| Post-flight | PASS | 217/217 tests (12 files), typecheck 0, lint 0, build 0 |

## F5 - Eval honesty and better rules

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 217/217 tests, typecheck 0, lint 0 (after F4 commit) |
| >= 25 new synthetic cases (12 scam covering every rule twice incl. obfuscation; 13 tricky benign) | PASS | 26 added (x01-x13 scam, b01-b13 normal), no real brands or numbers; `eval-data.test.ts` asserts >= 12/13, every one of the 18 rules labelled >= 2 times in the new scam cases, all 4 obfuscation styles, no 10-digit phone numbers. Originals kept (now annotated with `expected_rules` and `identifiers`) |
| n05 delivery OTP FP | FIXED | `otp_pin_request.unlessFollowedBy`: a code right after "share OTP" means the message issued the code; test also proves "share the OTP you received with our delivery agent" still fires |
| n09 "do not guarantee future returns" FP | FIXED | `guaranteed_returns.adjacentNegation`; test proves "This is not a scam, guaranteed returns..." still fires |
| n06 / n18 move_platform FPs | FIXED by requiring corroboration | `move_platform.needsCorroboration` (stated in rules.ts header): kept only with another rule in the same text; `runRules` still reports it raw |
| Obfuscation support | ADDED | `normalise()` in `signals/regex.ts` (spaced letters, emoji separators, zero-width chars) with an offset map, so quotes stay exact substrings of the input (test); small Hinglish pattern set with "mat/nahi" negation guards (tests) |
| eval/run.ts writes eval/RESULTS.md | PASS | `npm run eval` -> "regex-only: precision 89.2%, recall 100.0%, FP 4, FN 0; identifiers: precision 100.0%, recall 100.0%". RESULTS.md has date, commit, modes, per-rule P/R, FP/FN lists, identifier P/R, "What this evaluation is NOT". Generated on the F5 working tree, so it says "bc47d7b (with uncommitted changes)"; those changes are this commit |
| with-AI mode | UNKNOWN (not run) | OPENAI_API_KEY not set; RESULTS.md says so |
| Remaining FPs (new tricky cases, left in on purpose) | REPORTED | b06 news article, b07 police awareness (digital_arrest), b08 society lucky draw, b11 "guaranteed returns are a red flag" |
| README numbers match RESULTS.md | PASS | README "Evaluation" table copied from RESULTS.md (93.9 / 89.2 / 100.0, 4 FP, 0 FN) |
| ReDoS after rule changes | PASS | `npx tsx scripts/redos-check.ts`: 64 functions/regexes x 20 inputs, worst 5.2 ms, 0 cases >= 200 ms |
| Post-flight | PASS | 229/229 tests (13 files), typecheck 0, lint 0, build 0 |

## F6 - Verified tier completion

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 229/229 tests, typecheck 0, lint 0 (after F5 commit) |
| HEAD-probe ScamSniffer domains list | PASS (measured) | `curl -sI .../blacklist/domains.json` -> `Content-Length: 9148722` (9.1 MB > 8 MB; for comparison all.json is 10097629) |
| Domain lookup | SKIPPED (over 8 MB, as the prompt directs) | constants `SCAMSNIFFER_DOMAINS_PROBED_BYTES`, `DOMAIN_LIST_BUDGET_BYTES` in `verified/index.ts`; /about explains it from those constants; a check containing a domain gets `DOMAIN_NOT_CHECKED_NOTICE` ("...Nothing found does not mean the site is safe.") |
| Fixture tests: domain hit / miss / list unavailable | DEVIATION | no domain list, so no hit/miss fixtures; replaced by tests "a domain gets no verified result and a notice that it was not checked (never 'clean')" and "no domain in the text: no domain notice" |
| docs/CHAIN_SUPPORT.md from real probes | PASS | `npx tsx scripts/probe-etherscan-chains.ts` (new) at 2026-10-29T17:14Z: Ethereum/Polygon/Arbitrum OK, BNB Chain/Base "Free API access is not supported for this chain"; matches `EVM_CHAINS.freeTier` exactly. First run timed out on BNB (network); recorded in the doc |
| Every verified finding: source name, asOf date, link to check | PASS | unavailable rows used to have `link: ""`; now `defaultLink()` per source (OFAC search, ScamSniffer file, gopluslabs.io, Tronscan, Etherscan). Test checks every result in both a healthy and an all-HTTP-500 run has an https link, a source name and `checkedAt`; OFAC/ScamSniffer non-unavailable rows have `dataAsOf` |
| On-chain "pattern" heuristics | SKIPPED | none can be explained in one sentence without implying a judgement (stated in CHAIN_SUPPORT.md) |
| Post-flight | PASS | 233/233 tests (13 files), typecheck 0, lint 0, build 0 |

## F7 - UI and accessibility

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 233/233 tests, typecheck 0, lint 0 (after F6 commit) |
| Clear separation of the three tiers | PASS (code + render test) | "Tier N of 3" text label on each tier plus its existing title and coloured border; `ui.test.ts` checks the labels |
| Risk header with plain-language explanation | PASS | `RISK_EXPLANATION` + `RISK_SYMBOL` (▲/!/○ text marker so colour is not the only signal) in `lib/risk.ts`, rendered by `RiskBadge` |
| Highlighted quotes | PASS | `<mark>` around each suspected quote (test) |
| Loading / error / empty / graph waking states | PASS (code); visual UNKNOWN | loading line + button text; error `role="alert"`; empty card text and tier empty texts (test); graph "waking up" after 3 s (existing) |
| Graph loads separately and never blocks the card | PASS | graph is fetched only on the user's click, after the card has rendered (unchanged design) |
| "What to do now" block | PASS | `lib/next-steps.ts` + `WhatToDoNow.tsx`: pause, verify via official channels, keep chat and transaction IDs, 1930 + cybercrime.gov.in, bank immediately; test checks every step |
| Notices shown on the card | FIXED (found in F7) | before F7 the card never rendered `notices`, so the identifier-cap (F1), AI-skipped (F2) and domain-not-checked (F6) notices were invisible; now shown as "Note:" lines (test) |
| Labels, focus order, aria-live | PASS (code); screen-reader behaviour UNKNOWN | focus moves to `#risk-card-title` after a result; `role="status" aria-live="polite"` "Result ready: <label>."; graph canvas has `role="img"` + label and the same links listed as text |
| Print stylesheet for the evidence pack | ADDED (none existed); print output UNKNOWN | "Print or save as PDF" button expands the pack then calls `window.print()`; `print:hidden` on form, screenshot picker, report form, buttons, canvas; `@media print` white background |
| "Illustrative demo data" wherever synthetic data appears | PASS | single `DEMO_LABEL` ("Illustrative demo data - not a real investigation") used by samples, evidence pack, seeded reports, graph script, eval data; graph view gains `synthetic` computed exactly from the seed scenario's hashes, and GraphPanel shows the label (PGlite test: seeded UPI -> true, other UPI -> false); the card shows the label for samples (test) |
| 375 px | PASS (code); rendering UNKNOWN | identifier chips `break-all`, card padding `p-4 sm:p-5`, existing ResizeObserver graph width |
| docs/UI_CHECKLIST.md | PASS | 7 sections of manual click-through steps |
| Banned-words test | PASS | still green (scans new components and lib copy) |
| Post-flight | PASS | 239/239 tests (14 files), typecheck 0, lint 0, build 0 |

## F8 - Deploy readiness

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 239/239 tests, typecheck 0, lint 0 (after F7 commit) |
| docs/DEPLOY.md | PASS | Vercel settings (Root Directory `web`, Mumbai `bom1` as a dashboard setting), required vs optional env names, SQL order + verification query, TigerGraph commands, keeping Supabase awake, warming TigerGraph, rollback. The env-name one-liner in it was run: prints only SET/MISSING |
| /api/health booleans/short statuses, never secrets | PASS | `ok, db, reports, graph, usageStore, llm, vision, etherscan`; no network calls; test fills every env var with sentinel values and asserts none (nor a 12-char prefix) appears |
| scripts/smoke-live.ts | PASS | against `npm run start` on :3312 (real .env.local: Supabase, TigerGraph, Etherscan): `ALL PASS (36 expectations)`; health showed `graph: tigergraph`, `usageStore: supabase`; sample 1 high, sample 2 high with the OFAC match (8.7 s), sample 3 low with no signals |
| README sections | PASS | problem, solution, ASCII architecture, three tiers, data sources and licences, limits, run and test, eval table copied from RESULTS.md, demo script matching the current UI copy, Known gaps |
| SPEC.md final decisions | PASS | appended "FINAL DECISIONS" (original prompt kept verbatim above it) |
| HUMAN_TASKS queued | PASS | 5 Vercel env + region, 6 push + redeploy, 7 smoke-live on the live URL |
| Live URL | UNKNOWN | not pushed (as instructed); HUMAN_TASKS 6-7 |
| Post-flight | PASS | 241/241 tests (14 files), typecheck 0, lint 0, build 0 |

# Round 2 (branch round2)

## G0 - UI inventory and baseline (read-only)

| Criterion | Result | Evidence |
|---|---|---|
| Inventory printed | PASS | routes, components with line counts, globals.css/layout.tsx, font loading (Geist via next/font/google, but body overridden to Arial), style counts (rounded 24, border 57, bg- 32, dark: 47, red 6, yellow 2, amber 16, sky 6, emerald 1, fuchsia 7, neutral 84, shadow 0, gradient 0), state locations, graph drawing, headers block |
| Baseline | PASS | 241/241 tests, typecheck 0, lint 0, build 0 on branch `round2` |

## G1 - CSP and headers that cannot break the app

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | same as G0 baseline, tree clean |
| Inline scripts checked in the build output | PASS (measured) | `.next/server/app/index.html`: 7 `<script>` + 1 `<script id="_R_">` inline (`self.__next_f.push(...)`, Turbopack bootstrap); `about.html`: 14; 0 inline style attributes; 0 client chunks containing `eval(` |
| CSP directives as required | PASS | already matched; kept the existing extra `default-src 'self'` and `worker-src 'self' blob:` (stricter fallback / graph library workers) |
| Header test parses the policy | PASS | `parseCsp`, `REQUIRED_CSP`, `checkCsp` in `security-headers.ts`; 5 new tests in `f1-safety.test.ts` (exact sources per directive, dev adds only unsafe-eval, checker catches a broken policy, other headers unchanged) |
| scripts/check-headers.ts against npm run start | PASS | `ALL PASS (48 checks)` on `/`, `/about`, `/api/health` (port 3313) |
| Trade-off on /about and DEPLOY.md, checklist line | PASS | /about privacy list (test), DEPLOY.md section 2b, UI_CHECKLIST section 7 |
| CSP in a real browser | UNKNOWN | no browser; queued in the checklist |
| Post-flight | PASS | 247/247 tests (14 files), typecheck 0, lint 0, build 0 |

## G2 - Contest policy

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 247/247 tests, typecheck 0, lint 0, tree clean (after G1) |
| Contested report stays visible, labelled "Contested, under review" | PASS | `reported_counts_v2` in `db/migrations/002_contest_policy.sql` returns contested rows with `contested=true`; `ReportedList` + evidence pack show `CONTESTED_LABEL`; test "a contested entry stays visible, labelled contested" |
| Never counts toward High; weak signal at most | PASS | `risk.ts` `contestedIdentifiers` raises Low to Elevated at most; 4 risk tests + end-to-end test "2 reports + scam text is High; after a contest it is visible, labelled, and Elevated" |
| Per-network daily contest cap kept | PASS | test "4th contest from one network is 429" |
| Reasons length-limited, never rendered | PASS | zod 10-500 (test: 400 for 5 and 501 chars); SQL check constraint; reason stored only in `contests`, test asserts it is absent from the API response; no component renders it |
| docs/MODERATION.md with exact SQL | PASS | list / dismiss / uphold / remove / housekeeping; test runs the list, dismiss and uphold blocks verbatim from the file against PGlite |
| Migration idempotent, code works before and after | PASS | `localDb({ migrations: false })` test: reads fall back to `reported_counts` (`contestPolicy: "legacy_hidden"`), contest refuses (`contest_unavailable` -> 503) and hides nothing. Migration runs on PGlite with the Supabase-only grants guarded by `pg_roles` |
| /about wording | PASS | about test: "The entry stays visible...", "Nobody can erase a report just by contesting it" |
| TigerGraph removal after an uphold | UNKNOWN | tg-setup never deletes; REST delete documented in MODERATION.md section 4, not run |
| Changed test (justified) | NOTE | "contested entries are hidden" replaced: it asserted the old policy this step removes; the old behaviour is now covered by the old-schema fallback test. One exact `toEqual` gained the new `contestPolicy` field (kept strict) |
| Post-flight | PASS | 260/260 tests (14 files), typecheck 0, lint 0, build 0 |

## G3 - Warning-context handling

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 260/260 tests, typecheck 0, lint 0, tree clean (after G2) |
| Warning/news/awareness detection (same sentence + previous sentence, Hinglish markers) | PASS | `src/lib/signals/context.ts`: protective-phrase markers only; previous sentence counts only within the same message and when this sentence continues it ("They...", "Such...", a quote, or the previous sentence ends with ":") |
| Hits still shown, collapsed, no weight | PASS | `Signal.context = "warning"`; `SuspectedList` `<details>` "Mentioned in a warning or news-style text"; `check.ts` counts only non-warning rules; warning hits do not corroborate `move_platform`; risk reason explains it |
| All hits in warning context, nothing else -> Low with explanation | PASS | test "warning-context hits are still shown (marked), with a plain reason" |
| Adversarial tests | PASS | decoy "Beware of fake sites." + scam in a different sentence still flagged; warning in a separate message still flagged; "Final warning" still flagged; Hinglish decoy still flagged |
| 4 known false positives -> Low | PASS | `context.test.ts` it.each (news article, police awareness, society lucky draw, red flag) |
| Digital arrest narrowed | PASS | rule-level `negation` ("no such thing as", "never ask...", "do not trust..."); test that the threat itself, incl. "do not tell anyone", still fires 3+ times |
| Lucky draw | NOTE | the society draw is not a warning text, so warning context alone could not fix it; "lucky draw" now needs a you/your/claim/bonus/fee/pay/send word nearby (other prize phrases unchanged), with tests |
| 8 new eval cases, existing untouched | PASS | w01-w04 scam with decoy warnings, v01-v04 benign warnings; script asserted the first 66 cases are byte-identical as JSON; `eval-data.test.ts` checks counts |
| Eval rerun, README matches | PASS | before: 66 cases, acc 93.9, P 89.2, R 100, FP 4, FN 0. After: 74 cases, acc 98.6, P 97.4, R 100, FP 1 (v01 bank advisory <- urgency_deadline), FN 0. Eval now counts only non-warning hits, same as the risk card |
| ReDoS | PASS | worst 4.8 ms, 0 cases >= 200 ms (context markers are simple linear regexes run per sentence) |
| Post-flight | PASS | 278/278 tests (15 files), typecheck 0, lint 0, build 0 |

## G4 - Minimalist UI redesign

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 278/278 tests, typecheck 0, lint 0, tree clean (after G3) |
| Palette as CSS variables, nothing else | PASS | `globals.css` `--paper/--ink/--muted/--hairline` + Tailwind theme tokens (`text-ink`, `text-muted`, `border-hairline`, `bg-paper`); dark mode removed; counts after: rounded 0 (only `border-radius: 0` in CSS), dark: 0, shadow 0, gradient 0, palette colour utilities 0 (were rounded 24, dark: 47, palette ~122) |
| Typography | PASS | system font stack (Geist / next/font removed; built index.html has 0 "Geist"); `.t-title` 40/44 (32/36 under 640 px), `.t-h2` 20/28 600, body 16/26, `.t-small` 14/22; identifiers in sans with `.break-id` |
| Spacing, single column | PASS (code) | `max-w-[40rem]`, `px-6`, sections `mt-12 sm:mt-16`, tiers `gap-12 sm:gap-16`; visual check UNKNOWN |
| No boxes/borders/shadows/radius; hairlines only between tiers and above evidence pack/footer | PASS (code) | `TierSection` `border-t border-hairline`; footer hairline |
| Buttons and focus | PASS (code) | `.btn-primary` ink square, `.btn-link` underlined text, hover = opacity/underline thickness; `:focus-visible` 2px ink outline, 2px offset (style test asserts the CSS) |
| Underline textarea + "Upload a screenshot instead" link; same style for transcript | PASS | `.field`; `ScreenshotTrigger` opens the hidden file input; render test |
| Risk level without colour | PASS | `RISK_SHORT` large word, `RISK_EXPLANATION` sentence, scale "Low signals · Elevated · High" with `aria-current` on the current level; render test |
| Tiers "01/02/03", rows, quotes, demo label, notes | PASS | render tests (`ui.test.ts`) |
| Graph grayscale | PASS (code); canvas output UNKNOWN | `nodeCanvasObjectMode="replace"`: focus filled #111111, others #ffffff with 1px #111111 stroke, links/arrows #767676, labels #111111 below; reduced motion: layout precomputed (`warmupTicks`), no animation, via `useSyncExternalStore` |
| Report form inline; header/footer; 404 | PASS | `ReportForm` collapsed link -> inline form; `SiteHeader` (ScamLens / About), `SiteFooter` (About, Not legal advice); new `app/not-found.tsx`; live: `/nope` -> 404 with "Page not found" in `_not-found.html` |
| Print | PASS (code); print output UNKNOWN | controls `print:hidden`, `@media print` black on white |
| prefers-reduced-motion | PASS (code) | CSS disables animation/transition; graph static |
| Style-enforcement test | PASS | `src/lib/style.test.ts` (shadow, rounded except rounded-none, gradient, dark:, palette colour utilities, arbitrary colours, hex allow-list, palette in CSS, system font only, scanner self-test) + WCAG contrast test (#767676 on white >= 4.5:1) |
| Render tests per state | PASS | `ui.test.ts` +9: risk scale, notes, contested, warning details, collapsed report form, graph buttons, header/footer/404, check form field/button/link/aria-live, no palette classes in any rendered state. Loading, error, waking and transcript states need clicks: UNKNOWN (UI_CHECKLIST) |
| Changed test (justified) | NOTE | `ui.test.ts` looked for "Tier 1 of 3"; G4 requires the headings "01 Verified" etc., so the assertion now checks those |
| docs/UI_CHECKLIST.md rewritten | PASS | 375 px, visual rules, states, keyboard-only, screen reader, 200% zoom, print, motion, CSP console |
| Live regression | PASS | `npm run start`: `/` 200, `/about` 200, `/nope` 404; check-headers `ALL PASS (48 checks)`; smoke-live `ALL PASS (36 expectations)` |
| Post-flight | PASS | 298/298 tests (16 files), typecheck 0, lint 0, build 0 |

## G5 - Docs and close-out

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight green | PASS | 298/298 tests, typecheck 0, lint 0, tree clean (after G4) |
| README updated | PASS | Design section; contest policy and warning-context rules under the risk rules; eval before/after table from RESULTS.md; demo script uses the new headings and big-word levels; Known gaps rewritten (manual contest review, single-sentence warning-context gaming, 1 remaining FP, browser checks pending); scripts and docs lists |
| DEPLOY.md, SPEC.md | PASS | DEPLOY: migration 002 step, MODERATION pointer, "After deploying" (smoke-live + check-headers), CSP trade-off (G1); SPEC: "ROUND 2 DECISIONS" appended |
| HUMAN_TASKS.md in the required order | PASS | 1 Supabase SQL (schema.sql + grants, because round 1 is still unpushed, then 002), 2 merge round2 into main and push, 3 warm/update TigerGraph, 4 smoke-live live, 5 check-headers live, 6 UI_CHECKLIST in a browser; optional items after |
| Final run | PASS | `Tests 298 passed (298)` (16 files), typecheck 0, lint 0, build 0; `npm run eval`: precision 97.4%, recall 100.0%, FP 1, FN 0; identifiers 100/100 |

# UI round: Minimalism & Swiss Style (branch ui-swiss, 2026-10-30)

Browser tooling for this round: headless Microsoft Edge driven over the Chrome DevTools Protocol by a throwaway Node script (outside the repo, no new dependency). Measurements are taken in that browser with `getBoundingClientRect` / `getComputedStyle`.

## U0 - Baseline and before-screenshots

| Criterion | Result | Evidence |
|---|---|---|
| Identity | PASS | `Abin-Shaji-Thomas` / `<owner email>`; branch `ui-swiss` from `main` (= `origin/main` at c860f73) |
| Pre-flight | PASS (one flaky run) | first `npm test`: `Tests 3 failed | 295 passed (298)`; the next three runs: `Tests 298 passed (298)` each. Failures did not reproduce (likely timing under load); typecheck 0, lint 0, build 0 |
| Before screenshots | PASS | `docs/screens/before-{home,sample1,about}-{375,768,1440,1920}.png` (12 files) |
| Measured content width (before) | PASS | 375: 327 px = 87.2%; 768: 592 px = 77.1%; 1440: 592 px = 41.1%; 1920: 592 px = 30.8% (same on /, sample 1 and /about) |
| Smallest tap target (before) | NOTE | 22 px (sample links), 19 px ("Back to the check" on /about) |
| Sample 1 risk (before) | PASS | "High" (meter did not exist yet) |
| Console (before) | PASS | no messages on /, after sample 1, /about |

## U1 - Tokens and tests

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight | PASS | 298/298, typecheck 0, lint 0, tree clean (after U0) |
| Ten Swiss tokens as CSS variables, light only | PASS | `globals.css` `:root` `--swiss-black` ... `--swiss-black-hover`, `color-scheme: only light`; Tailwind tokens `text-swiss-*`, `bg-swiss-*`, `border-swiss-*` (grey and tan deliberately not registered as Tailwind colours) |
| Base styles | PASS | body 1.125rem/1.6, `.t-title` weight 300 clamp(2.5rem, 6vw, 6rem)/1.05, `.t-h2` 1.5rem weight 400, `.t-small` 0.875rem/1.5, `.eyebrow`, `.measure` 65ch, `.card`, `.band`, risk/meter alert selectors, focus 2px black offset 3px, links hover clay 200ms, reduced motion, print black on white |
| Style test updated (deliberate requirement change) | PASS | allow-list = the ten hex values; still bans shadow, rounded (except rounded-none), gradient, dark:, Tailwind palette colours (now including black and white); new: 200ms colour-only transitions, no keyframes/animate-*, `color-scheme: only light`, font stack |
| Contrast test | PASS | `src/lib/contrast.test.ts`: 9 text pairs >= 4.5 (lowest: clay on paper 6.23), 6 UI pairs >= 3 (lowest: tan on white 3.07); grey/tan never text; tan never on `.band`; alert only in `[data-level="high"]` CSS and GraphPanel |
| Tests catch violations | PASS | injected `.x{color:var(--swiss-tan)}`, `.band .y{border-color:var(--swiss-tan)}`, `.z{color:var(--swiss-alert);transition:transform 300ms}` -> `Tests 4 failed | 28 passed (32)`; file restored |
| Post-flight | PASS | `Tests 319 passed (319)`, typecheck 0, lint 0, build 0 |

## U2 - Grid and typography

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight | PASS | 319/319, typecheck 0, lint 0, tree clean (after U1) |
| 12-column `.grid`, bands full-bleed, one column below 768 px | PASS | `globals.css` `.grid` exactly as specified (+ `.grid--bar` for header/footer); every top-level part is a full-width `<section>` holding one `.grid`; `main > section ~ section` 1px rule; the facts `<dl>` moved off Tailwind's `grid` class to `.facts` |
| Header, hero, form columns, result header, tier grid, What to do now band, footer | PASS | render tests in `ui.test.ts` "Swiss grid layout" (+6): hero `lg:col-span-9`/`lg:col-span-6`, form `lg:col-span-8` + aside `lg:col-start-10 lg:col-span-3` with 2px rule, 3 cards `lg:col-span-4` with aria-hidden 01-03 and real h2, band with heading 1-4 and steps 5-12, meter 1/2/3 filled for Low/Elevated/High, header/footer on the grid |
| No horizontal overflow at 375/768/1280/1440/1920 (/, sample 1) | PASS | `overflow false` at all five widths, both states |
| Space targets | PASS | grid box: 100% at 375-1440, 91.7% at 1920 (capped at 1760 px); content box: 89.3 / 92.0 / 92.5 / 93.3 / 86.7%. h1 = 74.5% of the content at >= 1024 (100% below). Form left+right span 100%; tier cards span 100% (3 columns at 1280+, 1 at 375/768). Longest paragraph line 62.6ch at desktop, 65.0ch max anywhere |
| Font actually used for weight 300 | NOTE (measured) | `CSS.getPlatformFontsForNode` on the h1: `Arial / ArialMT`. Windows maps "Helvetica" to Arial (`HKLM\...\FontSubstitutes: Helvetica REG_SZ Arial`), so the stack stops before "Segoe UI"; Arial has no light face, so headings render at 400. `segoeuil.ttf` is installed but unused. Layout checked at 400 and it works (screens reviewed) |
| Console | PASS | no messages on / and after sample 1 |
| Tap targets | NOTE | smallest 29 px (sample links, Print link); buttons and links are restyled to >= 44 px in U3 |
| Post-flight | PASS | `Tests 325 passed (325)`, typecheck 0, lint 0, build 0 |

## U3 - Components and states

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight | PASS | 325/325, typecheck 0, lint 0, tree clean (after U2) |
| Buttons, outline button, text links, textarea, inline report/contest fields, focus | PASS | `.button` / `.button--outline` / `.btn-link` (44 px min height) / `.textarea` / `.field` / `.checkbox` in `globals.css`; no `outline: none` left; render + CSS tests (+3) |
| Tiers, finding rows, notices, quotes, contested label, risk header | PASS | rows divided by 1px `--swiss-rule`, black 600 titles, small source line; notices plain secondary paragraphs; contested = 600 clay; `data-level="high"` word; tests (+4) |
| Graph | PASS (code); canvas UNKNOWN until U4 | filled black focus node, 1.5px stroke, 1px grey links, 2.5px alert on evidence-path links, black labels; reduced-motion code unchanged; tests (+2) |
| /about, 404 | PASS | two-column sections, alternate bands, sources as ruled rows; decorative `404` (aria-hidden) with existing text; tests (+2) |
| States that need clicks (loading, error, waking, transcript, open report form) | UNKNOWN here | covered by CSS classes and checked in the browser in U4 |
| Post-flight | PASS | `Tests 336 passed (336)`, typecheck 0, lint 0, build 0 |

## U4 - Browser verification (headless Microsoft Edge, `npm run start`)

Measured per window size (same on /, samples 1-3; /about and /nope have no form):

| Width | Overflow | Grid box / window | Content / window | h1 block | Text box | Smallest body font | Smallest tap target |
|---|---|---|---|---|---|---|---|
| 375 x 812 | false | 100% | 89.3% | 335 px (100%) | 335 px | 18 px body, 14 px small | 44 px |
| 768 x 1024 | false | 100% | 92.0% | 707 px (100%) | 707 px | 18 / 14 | 44 px |
| 1280 x 800 | false | 100% | 92.5% | 882 px (74.5% of content) | 781 px | 18 / 14 | 44 px |
| 1440 x 900 | false | 100% | 93.3% | 1001 px (74.5%) | 886 px | 18 / 14 | 44 px |
| 1920 x 1080 | false | 91.7% (1760 px cap) | 86.7% | 1240 px (74.5%) | 1099 px | 18 / 14 | 44 px |

| Criterion | Result | Evidence |
|---|---|---|
| Space targets | PASS | grid box >= 88% at 1280/1440/1920 (100 / 100 / 91.7%); h1 74.5% of the container (>= 65%); form left+right span 100%; tier grid spans 100%, 3 columns at >= 1280, 1 column at 375/768; longest line 65.0ch (768) / 62.6ch (desktop) |
| Behaviour unchanged | PASS | sample 1 High, meter 3; sample 2 High, meter 3; sample 3 Low signals, meter 1 (before: sample 1 High) |
| Graph view | PASS | canvas drawn; pixels only white, black and #b00020 (plus antialiasing); after the fix only links named in a listed path are alert; backend line "postgres (TigerGraph unavailable)" |
| Inline report form | PASS | opened (never submitted): select 1px black underline, 44 px, visible labels, 44 px checkbox rows, submit `class="button"` |
| Console / CSP | PASS | no messages on /, samples 1-3, graph, report form, /about; /nope only `Failed to load resource: ... 404 (Not Found)` (the page's own 404 status) |
| Focus | PASS | Tab order ScamLens -> About -> text box -> Upload -> samples 1-3 -> footer About (Check is disabled while empty); after a check focus on `risk-card-title`, then Contest -> Show links -> Copy -> Preview -> Print -> About; every stop `2px solid rgb(0, 0, 0)`, offset 3px |
| Reduced motion | PASS | every transition-duration `0s` (normal: `color 0.2s`, `background-color, color 0.2s`, `border-color 0.2s`) |
| Print | PASS | text colours only `rgb(0, 0, 0)`; band `rgb(255, 255, 255)`; risk word `32px rgb(0, 0, 0)`; form/header/footer hidden; 3 tiers visible |
| Zoom 200% at 1280 | PASS | 640 px CSS viewport at scale 2: no overflow, text length 2630 = 2630 at 1440, 11 buttons reachable |
| Contrast in the browser | PASS | body black on white 21.00; black on paper 18.63; secondary #4b5563 on white 7.56; link hover clay 7.02; High #b00020 on white 7.33; button label white on black 21.00 |
| Font for weight 300 | NOTE | Arial (ArialMT) at 400; see U2 |
| Deviations found and fixed | FIXED | (1) every graph link was alert because shared evidence wording matched unrelated links -> match by both end labels in one path; (2) graph rule printed as an empty line -> hidden in print; (3) /about emergency steps split into grid cells -> numerals positioned absolutely; (4) header/footer About 37 px wide and sentence links 16-20 px tall -> 44 px; (5) visible gap beside sentence links -> negative margin |
| Screenshots | PASS | `docs/screens/after-{home-375,home-1920,sample1-375,sample1-768,sample1-1440,sample1-1920,about-375,about-1920,nope-1440,graph-1440,report-1440,print-1440}.png` (taken before the last 1px tap padding change, which is not visible) |
| Post-flight | PASS | `Tests 338 passed (338)`, typecheck 0, lint 0, build 0 |

## U5 - Health build field and docs

| Criterion | Result | Evidence |
|---|---|---|
| Pre-flight | PASS | 338/338, typecheck 0, lint 0, tree clean (after U4) |
| `/api/health` returns `build` | PASS | `buildId()` = first 7 hex chars of `VERCEL_GIT_COMMIT_SHA`, else `"local"`; local `npm run start`: `{"ok":true,...,"etherscan":true,"build":"local"}`; check-headers `ALL PASS (48 checks)` |
| Health test | PASS | exact key list incl. `build`; at most 7 characters of the SHA; no secret prefix in the JSON; non-hex input -> `"local"`; schema rejects a non-hash build |
| README, SPEC, DEPLOY, HUMAN_TASKS | PASS | README Design rewritten (palette, why grey/tan carry no text, Windows font note), health line, Known gaps; SPEC "UI ROUND DECISIONS"; DEPLOY section 6 compares `build` with `git rev-parse --short HEAD`; HUMAN_TASKS updated to the pushed state (old "merge round2" task replaced) |
| Post-flight | PASS | `Tests 339 passed (339)`, typecheck 0, lint 0, build 0 |

## U6 - Push and live verification

| Criterion | Result | Evidence |
|---|---|---|
| Remote not ahead | PASS | `git fetch origin`; `main..origin/main` = 0 commits |
| Fast-forward and plain push | PASS | `git merge --ff-only ui-swiss`; `git push origin main`: `c860f73..9af7c4f  main -> main`; `git log origin/main -1`: `9af7c4f Abin-Shaji-Thomas <<owner email>> docs(readme): ...` |
| Live build = HEAD | PASS | 01:00:39 no `build` key (old deployment); 01:01:00 `"build":"9af7c4f"` = `git rev-parse --short HEAD` |
| smoke-live | FAIL then PASS | first run (about 1 minute after the new deployment went live): `FAIL [crypto-investment] request completed (TimeoutError)`, `FAIL [bank-alert] request completed (TypeError)`, `2 FAIL (16 expectations)`. No API code changed in this round (`git diff c860f73..HEAD -- src/app/api src/lib/check.ts src/lib/verified src/lib/signals src/lib/reports` is empty); a direct check then answered 200 in 1.6 s; second run: `ALL PASS (36 expectations)`. Likely a cold start of the fresh deployment; not reverted |
| check-headers live | PASS | `ALL PASS (48 checks)` |
| Live screenshots and console | PASS | `docs/screens/live-{home-375,home-1920,sample1-375,sample1-1440,sample1-1920,about-1440}.png`; no console messages on /, sample 1, /about; no overflow; grid 91.7% at 1920; smallest tap target 44 px; sample 1 High, meter 3. Matches the local after-screenshots |

# Final quality round (branch final-quality, 2026-10-30)

## J0 - Pre-flight and truth

| Criterion | Result | Evidence |
|---|---|---|
| Identity | PASS | `Abin-Shaji-Thomas` / `<owner email>` |
| Swiss UI round on main | PASS | `b41bd7d style(layout)`, `b55007e style(ui)`, `22293cb feat(health)` in `git log`; main = origin/main |
| Baseline | PASS | `Tests 339 passed (339)` (17 files), typecheck 0, lint 0, build 0 |
| Live current | PASS | live `"build":"9e95b19"` = `git rev-parse --short HEAD` |
| Env names | PASS | SET: Supabase (3), pepper, Etherscan, TG (3), RECEIPT_SIGNING_KEY (`valid ed25519`); MISSING: optional tuning names and all OPENAI_* (AI off by owner decision) |

## J1 - Knowledge base and sync tooling

| Criterion | Result | Evidence |
|---|---|---|
| 22 files with the six template sections | PASS | `docs/knowledge/README.md` ... `20-LAUNCH-KIT.md` |
| Generated blocks and facts | PASS | `npm run docs:generate`: rules, env, limits, chains, routes, deps, db, eval, tests, commits; facts for rule count, limits, eval numbers |
| docs:check | PASS | `docs:check PASS` |
| Stale edit detected | PASS | rule_count fact 18 -> 17 and a rule id edited in a copy: `FAIL ... generated block "rules" is stale`, `FAIL ... fact "rule_count" says "17" but the code says "18"`, `docs:check FAILED (2 problem(s))`; restored, `docs:check PASS` |
| vitest docs test | PASS | `web/src/lib/docs.test.ts` (4 tests incl. one proving each checker rule fires) |

## J2 - Live truth

| Criterion | Result | Evidence |
|---|---|---|
| tg-setup scope reviewed | PASS | queries `FOR GRAPH <TG_GRAPH>`, upserts to that graph, no deletes; one global step (migration 001 adds an attribute to the global `Report` type) noted |
| TigerGraph awake and parity | FAIL (human task) | 9 wake attempts over 5 minutes, each `HTTP 500 ... Failed to start workspace. Auto start is not enabled for this workspace.`; tg-setup not run; nothing changed in TigerGraph |
| App fallback | PASS | `POST /api/graph` (sample 1 UPI) on `npm run start`: `backend: 'postgres (TigerGraph unavailable)', nodes: 5, paths: 2, synthetic: true` |
| Live health | PASS | `"usageStore":"supabase"`, `"llm":false`, `"vision":false` (J0) |
| AI mode truth (owner: AI permanently off, zero model calls) | PASS | new AI status `off`; Suspected tier says "Suspected signals come from fixed pattern rules only."; AI off no longer counted as an unavailable source; skipped-but-configured stays `unavailable` |
| Screenshot reading off | PASS | `CheckForm screenshots={visionConfigured(process.env)}`; local home page: "Screenshot reading is off. Paste the text instead."; `/api/transcribe`: `{"ok":false,"error":"Screenshot reading is off. Paste the text instead."}` (503) |
| Tests for both states | PASS | ui.test.ts +6 (form off/on, home page from env, result with AI off has no AI words, skipped AI named, /about off/on); transcribe test asserts no provider named |
| Changed tests (deliberate) | NOTE | signals test "no key -> unavailable" became "no key -> off"; transcribe "not configured" now expects the screenshot-off sentence |
| Post-flight | PASS | `Tests 349 passed (349)`, typecheck 0, lint 0, build 0, `docs:check PASS` |

## J3 - Detection quality

| Criterion | Result | Evidence |
|---|---|---|
| Solicitation beats a marker (both ways) | PASS | "Never send money to strangers; guaranteed returns are a red flag" -> warning context, Low; "Beware of fake sites, send 5000 USDT now to join our group, guaranteed profit" -> counted, not Low; +4 flagged and +3 stay-warning cases (Hinglish included) |
| General conditional-awareness marker | PASS | v01 bank advisory -> Low; English and Hinglish variants -> warning; decoys "If you do not pay the clearance fee within 2 hours, police will arrest you", "If someone says this is a fraud, ignore them and pay ...", Hinglish threat -> still flagged. Found and fixed on the way: the old "do not + advice" marker read "If you do not pay" as advice |
| ReDoS | PASS | `worst case: 5.5 ms (runRules (all) on "devanagari"); cases >= 200 ms: 0` (66 functions x 20 inputs) |
| 6 eval cases, old cases untouched | PASS | j01-j06 appended; first 74 cases byte-identical to HEAD (script check); `eval-data.test.ts` asserts 3 + 3, 80 total, unique ids |
| Eval before/after | PASS | 74 cases, round 2 code: P 97.4%, R 100.0%, FP 1 (v01), FN 0. Same 80 cases with the pre-J3 code: acc 93.8%, P 92.7%, R 95.0%, FP 3 (v01, j04, j06), FN 2 (j01, j03). Final: acc 100.0%, P 100.0%, R 100.0%, FP 0, FN 0. New false negatives: none |
| Honesty note | NOTE | the 6 cases were written after the fix (regression examples, not a blind test); README says so |

## J4 - Contest retention

| Criterion | Result | Evidence |
|---|---|---|
| Migration 003, idempotent | PASS | `web/db/migrations/003_contest_retention.sql`: `purge_old_contests()` deletes contests that are decided or older than 90 days; the file runs twice cleanly; a second purge deletes 0 |
| PGlite tests | PASS | `retention.test.ts` (6): 3 of 5 rows purged (old pending, dismissed, upheld), recent pending kept; reports and the contested label untouched; the app works without 003; MODERATION.md section 5 SQL runs as written; SQL days equal `CONTEST_RETENTION_DAYS` |
| /about and docs | PASS | /about: "deleted in a monthly clean-up once the contest is decided or 90 days old" (asserted in about.test.ts); knowledge 08, 16, 17; MODERATION.md; HUMAN_TASKS |
| Found on the way | NOTE | Python on Windows wrote CRLF into MODERATION.md and broke the existing SQL-block test; doc edits are now made with Node (LF) |

## J5a - Coverage ledger

| Criterion | Result | Evidence |
|---|---|---|
| Built only from run data | PASS | `buildCoverage(result)` in `web/src/lib/coverage.ts` uses source rows, statuses, reasons, `dataAsOf`, check times and identifier types; test asserts no date literal in the lib or component |
| All statuses render; unavailable shown as unavailable | PASS | `coverage.test.ts` (6): checked with list date, unavailable with reason, not applicable, skipped (limit), rate-limit skip note for a second wallet |
| Not-checked lines | PASS | UPI ("UPI IDs have no public database here; only community reports are used."), TRON wallet sources not looked up, domains not checked, Etherscan chains not enabled on this plan |
| Never "clean"/"safe"; no AI row while off | PASS | test |
| Browser at 375 / 1440 | UNKNOWN until J6 | |

## J5b - "I already paid" mode

| Criterion | Result | Evidence |
|---|---|---|
| Control and ordered plan | PASS | "I already paid" outline button inside the What to do now band (collapsed by default); 7 steps in the required order, "No step can promise to get your money back. Not legal advice." (`complaint-draft.test.ts`) |
| Fields and draft in the browser | PASS | amount, date and time, payment method, transaction ID as React state; `buildComplaintDraft` uses the shared extractor with `raw` identifiers (`+91 98765 43210` kept as typed); chat text not copied; draft says it is a draft, not legal advice |
| No request while editing or copying | PASS (without DOM) | `fetch` stubbed with `vi.stubGlobal`; render, field updates and `copyComplaintDraft` -> `fetchSpy` not called; source scan: no fetch/XMLHttpRequest/sendBeacon/WebSocket/`/api/` in the component or module. Click-through: UNKNOWN until the J6 browser run |
| Flaky test seen | NOTE | first full run: `SQL increment_usage: atomic count, denied calls are not counted` timed out at 5000 ms (PGlite under load, unrelated file); rerun alone `Tests 18 passed (18)`, full rerun `Tests 381 passed (381)` |

## J5c - Signed check receipts

| Criterion | Result | Evidence |
|---|---|---|
| Key | PASS | `RECEIPT_SIGNING_KEY` in web/.env.local parses as `valid ed25519` (J0); tests use ephemeral keys only; no key generated or printed by the run |
| Receipt content | PASS | version, keyId, issuedAt, build, riskLevel, mode, tiers (tier, kind, title, source, asOf, link), notices, coverage, masked identifiers, textDigest (HMAC-SHA256, HKDF-derived key) |
| Tests (ephemeral keys) | PASS | `receipts.test.ts`: sign/verify; tamper on every top-level field, a nested finding and the signature; wrong key; missing/invalid/non-Ed25519 key = off (no receipt, health false); no quote, chat word or full identifier in a receipt; digest match and mismatch; canonical key order; deterministic re-signing; WebCrypto Ed25519 with the published key; evidence-pack code; key route 200/404; verify route valid / tampered / text / 413 / 429; all samples sign |
| API and health | PASS | `CheckResponse.receipt` optional; smoke-live accepts it with or without and verifies it with the published key when present; `/api/health` `receipts` boolean (health tests updated deliberately: one new key) |
| /verify page and download | UNKNOWN until the J6 browser run | |

## J5d - Pattern library

| Criterion | Result | Evidence |
|---|---|---|
| Generated from rules.ts; every rule appears | PASS | `patterns.test.ts`: one `<section id="<rule id>">` per rule, guide keys = rule ids |
| Content per rule | PASS | six labelled parts x 18; intro "These are patterns, not verdicts."; every example triggers its own rule via `runRules` |
| Exclusions from guards | PASS | negation, adjacent negation, needs a second rule, warning context; rule-specific notes for 5 rules |
| Links | PASS | footer `/patterns` (and `/verify`); each Suspected finding links `/patterns#<rule id>` |
| Banned words | PASS | page text and guide contain none (test, and the src-wide banned-words test) |
| Browser at 375 / 1440 | UNKNOWN until J6 | |

## J6 - Final quality gate

Full matrix and scenario table: `docs/knowledge/18-RELEASE-READINESS.md`.

| Criterion | Result | Evidence |
|---|---|---|
| Scenarios (13 + 4 error paths) | PASS | samples High/High/Low; identifier-only Low; obfuscated, Hinglish and decoy texts Elevated; news warning Low with hits marked warning; 400/413/400/503 error paths; every check signed |
| Failure injection | PASS | invalid Etherscan key, unreachable Supabase/TigerGraph -> unavailable rows, no "No known reports", graph unavailable |
| Daily limit | PASS | 429 in 18 ms with Retry-After |
| Privacy audit | PASS | logger only; health booleans; receipts without raw text |
| Performance | PASS | p50 1,118 ms, p95 3,605 ms over 10 checks |
| Browser (5 widths x 6 pages, features, print, zoom, focus) | PASS after fix | inline /verify link 16 px -> 44 px (fix(ui) b99d27d); all else as in the matrix |
| Suites | PASS | `Tests 402 passed (402)`, typecheck 0, lint 0, build 0, docs:check PASS, eval FP 0 / FN 0 |

## J7 - Share preview and launch kit

| Criterion | Result | Evidence |
|---|---|---|
| Metadata and images | PASS | `/opengraph-image` 200 image/png 42,067 bytes, 1200x630 (viewed: white, black rule, wordmark, one line, secondary-grey text); og:* and twitter:card summary_large_image tags in the page head; `/icon.svg` 200 image/svg+xml; `launch.test.ts` (4); style and contrast tests pass |
| Launch kit | PASS | `docs/knowledge/20-LAUNCH-KIT.md`: X, LinkedIn, WhatsApp drafts and a 30-second script; no accusation words, no recovery promise, not legal advice, limits stated, AI line matches "switched off", link placeholder <URL> |
| Demo doc from real outputs | PASS | `14-DEMO-AND-JUDGING.md` 90-second and 4-minute scripts use the release-gate strings and levels; rule count via FACT marker (docs:check) |

## J8 - Push and live verification

| Criterion | Result | Evidence |
|---|---|---|
| Remote not ahead | PASS | `origin-only commits: 0` |
| Fast-forward and plain push | PASS | `9e95b19..f201b16  main -> main`; `git log origin/main -1`: `f201b16 Abin-Shaji-Thomas <<owner email>> docs(launch): ...` |
| Live build = HEAD | PASS | 08:15:24 `9e95b19`, 08:16:07 `"build":"f201b16"`; `"receipts":true` |
| smoke-live | PASS | `ALL PASS (39 expectations)`; receipts verify for all three samples (codes icPmIKap2eEM, P4bfYH1_s6tN, 8DPUAodT-Dbr) |
| check-headers | PASS | `ALL PASS (48 checks)` |
| Live browser | PASS | 6 screenshots `docs/screens/live-*.png` (replacing the UI round's set); console empty on /, /about, /patterns, /verify; sample check High 3/3; I already paid: 7 steps, 0 requests; receipt download -> /verify valid in the browser, tampered rejected |

# TigerGraph finish round (branch tg-finish, 2026-10-30)

Owner facts: Supabase migrations 002 and 003 are run; the TigerGraph workspace is Running; the owner applied the global `reporter_key` change by hand and `tg-setup.ts` then reported `parity TigerGraph vs Postgres: 19/19 queries SAME`; the live site shows "Graph backend: tigergraph". AI stays off.

## G0 - Baseline

| Criterion | Result | Evidence |
|---|---|---|
| Identity, branch | PASS | `Abin-Shaji-Thomas` / `<owner email>`; `tg-finish` from main 89ad467; main ahead 0, behind 0 |
| Live health | PASS | `{"ok":true,...,"graph":"tigergraph","usageStore":"supabase","llm":false,"vision":false,"etherscan":true,"build":"89ad467","receipts":true}` = HEAD |
| Baseline suites | FLAKY | first run `Tests 6 failed | 400 passed (406)` (six PGlite tests at 5.7-6.7 s > 5000 ms default); rerun `Tests 406 passed (406)`; typecheck 0, lint 0, build 0, docs:check PASS. Fixed next (G5.3 moved forward) |
| WORKING_RULES | PASS | narrow TigerGraph permission added; dashboards stay human-only |

## G5.3 (moved forward) - Flaky PGlite tests

| Criterion | Result | Evidence |
|---|---|---|
| Cause found | PASS | test hooks are already reset in afterEach (usage.test.ts, transcribe.test.ts); measured `localDb()`: `sequential localDb() ms: 1321, 981, 1257 | 6 in parallel: 7943 ms` -> start-up cost under parallel workers exceeds the 5000 ms default |
| Fix without weakening | PASS | `vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })` in the 8 PGlite suites, with a comment; no assertion changed |
| Stability | PASS | four runs in a row: `Tests 406 passed (406)` x 4 |

## G1 - tg-setup honest about the migration

| Criterion | Result | Evidence |
|---|---|---|
| Migration file = what the owner ran | PASS | `graph/migrations/001_report_reporter_key.gsql` now has `USE GLOBAL`, `ADD ATTRIBUTE (reporter_key STRING DEFAULT "")`, RUN; the old `DROP JOB` line removed |
| Schema check before any migration | PASS | `decideMigration` in `web/src/lib/graph/migrations.ts`: present -> skip; missing -> exit 2, "HUMAN STEP REQUIRED" with the file's GSQL; no global call (test asserts tg-setup no longer sends migrations) |
| Error detail, masked | PASS | client errors carry the response body (800 chars max), secret and bearer token masked (tests with a mocked fetch) |
| Live tg-setup | PASS | first run: queries created, install `FAILED: fetch failed` (dropped long request; `--check` then showed `19/19 queries SAME`, so the install had completed); added install retries; full re-run: `migration 001 already applied (Report.reporter_key exists)`, `Query installed successfully: q1...q4`, `22 vertices, 21 edges`, `parity TigerGraph vs Postgres: 19/19 queries SAME`, exit 0; "Access Denied" count 0 |

## G2 - Q2 investigation (read-only on live data)

| Criterion | Result | Evidence |
|---|---|---|
| Does any demo data produce a Q2 path? | YES | read-only Postgres read of the synced payload: 7 wallets, 2 flagged (synthetic), 5 PAID edges; `Q2 on every wallet (Postgres): 4 of 7 have a path` (ex, w2 [2 hops], w3, w4); TigerGraph `q2: 4 of 7 case(s) return rows`; nothing written to Supabase, graph-demo not re-run |
| Why it looked empty | FOUND | tg-setup printed only the first case (the collection wallet, no path); it now prints how many cases return rows and the first non-empty one |
| UI never implies a Q2 path that was not found | PASS | GraphPanel lists only the paths returned; no Q2 line when none |
| Human seeding option | NOT NEEDED | a labelled demo path already exists; the demo doc says which wallet to paste |

## G3 - Graph drawing

| Criterion | Result | Evidence |
|---|---|---|
| Cause | FOUND | `cooldownTicks={Infinity}` meant onEngineStop never fired, so nothing could fit the view; `graphData` was rebuilt every render (layout restarts); the ref needed for zoomToFit is not reachable through next/dynamic |
| Fix | PASS | new client-only `FitGraph.tsx` holds the ref: memoised data, bounded cooldown (160 ticks), `zoomToFit(400 or 0, 40)` on engine stop and again on resize; height 300 / 360-480 px; labels below nodes with a white halo; colours unchanged |
| Browser (sample 1 -> Show links, local, backend tigergraph) | PASS | first measurement after a resize showed margins 0 at 375 and 768 (clipped) -> added refit on resize; then resize: 375 margins 58/41/71/26, 768 226/41/237/27, 1440 509/42/517/28; fresh 375: 30/46/38/31; overflow false everywhere; console [] |
| Q2 path text in the UI | PASS | pasted demo wallet 0x9377...32d8: `Q2 Funds moved 0x9377***32d8 -> 0xc846***38Ba -> 0x1DD0***9A07 (2 hops) to an address flagged by synthetic flag (demo).` (matches the demo doc) |
| Tests | PASS | `drawing.test.ts` (canvas height, label size, padding); ui.test.ts graph pin now reads FitGraph.tsx (same assertions; values that changed on purpose: 160 warm-up ticks, label halo order) plus fit-on-stop and refit-on-resize |

## G4a - Graph timing

| Criterion | Result | Evidence |
|---|---|---|
| `elapsedMs` in /api/graph | PASS | optional integer in the `GraphView` zod schema, set for direct and fallback answers, absent when unavailable |
| Note | PASS | `graphBackendLabel`: "tigergraph (N ms)"; fallback keeps "postgres (TigerGraph unavailable)" |
| Tests | PASS | tigergraph.test.ts +2 (direct answer with timing and label, non-integer rejected; unavailable without timing and the route's response validates) and the fallback test checks its label |

## G4b - Link graph row in the coverage ledger

| Criterion | Result | Evidence |
|---|---|---|
| Optional graph argument | PASS | `buildCoverage(result, { graph })`; GraphPanel reports each lookup via `onLookup`; RiskCard keeps it per `checkedAt` |
| Statuses | PASS | coverage.test.ts +3: not looked up, checked ("tigergraph, 412 ms"), fallback label with ms, unavailable, not applicable (phone only); never clean/safe |
| Receipt unchanged | PASS | `buildCoverage(r)` without the argument has no graph row (row ids asserted); receipts.test.ts still passes |

## G4c - Linked-identifier hints

| Criterion | Result | Evidence |
|---|---|---|
| Targets | PASS | at most 3 identifiers of type upi/evm/tron/telegram with a Reported entry; none when reports are unavailable |
| Background, sequential, non-blocking | PASS | `runLinkHints` awaits one lookup at a time (test asserts one active call); the card renders with no hint first (SSR test) |
| With links / no links / failure | PASS | `link-hints.test.ts`: sentence "This UPI ID is linked to 2 other identifiers in community reports. Show links to see how.", not-proof note, demo label; no links -> empty; 500 -> skipped; 429 -> stop; network error -> nothing; no banned words |
| Bug found by a test | FIXED | `hints?.at === result.checkedAt` was true when both were undefined; LinkHints and RiskCard now check the object first |

## G4d - /about Link graph section and live counts

| Criterion | Result | Evidence |
|---|---|---|
| TigerGraph built-in statistics with the graph token | PASS | read-only probe: `stat_vertex_number` Report 8, UPI 2, Wallet 7, TelegramHandle 5 (22); `stat_edge_number` MENTIONS 16, PAID 5 (21) |
| Route | PASS | `GET /api/graph/stats`: graph limit, TigerGraph then Postgres, 5-minute cache, counts only, 404 when nothing answers |
| Tests | PASS | `stats.test.ts` (7): success, Postgres fallback, failure 404 and empty line, success response and cache header, cache window, 429 with no graph query; ui.test.ts /about now lists 9 sections (deliberate: new section) |
| /about static | see build | `/about` remains ○ (static) in the build route list |

## G4e - Health wording

| Criterion | Result | Evidence |
|---|---|---|
| Shape unchanged | PASS | no code change; health.test.ts unchanged |
| Documented | PASS | README routes block, DEPLOY section 6, knowledge 10 and 13: "graph":"tigergraph" means configured, not awake |

## G5.1 - Font order

| Criterion | Result | Evidence |
|---|---|---|
| Stack changed | PASS | `globals.css`, the graph canvas font and `style.test.ts`: `"Helvetica Neue", "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| Light face on Windows | PASS | `CSS.getPlatformFontsForNode` on the h1: `Segoe UI Light / SegoeUI-Light` (was `Arial / ArialMT`); body `Segoe UI` |
| No overflow | PASS | / and sample 1 at 375, 768, 1280, 1440, 1920: overflow false, grid 100/100/100/100/91.7%, tap 44 px, sample 1 High 3/3, console empty |
| Docs | PASS | README, HUMAN_TASKS item 6.5, UI_CHECKLIST font note and row 4, knowledge 11, 16, 17 |

## G5.2 - Report form on samples

| Criterion | Result | Evidence |
|---|---|---|
| Hidden on samples | PASS (already) | RiskCard renders the form only when the card is not a demo; ui.test.ts +4: samples 1-3 with demo -> no "Report these identifiers"; same text as a non-demo -> offered |

## G5.4 - smoke-live warm-up

| Criterion | Result | Evidence |
|---|---|---|
| Warm-up | PASS (code) | polls /api/health up to 60 s, then one harmless /api/check (60 s timeout, one retry); commented that it uses 1 of the 40 daily checks; not counted as an expectation. Live run in G7 |

## G6 - Docs sweep

| Criterion | Result | Evidence |
|---|---|---|
| Stale facts removed | PASS | "36 expectations" (DEPLOY, HUMAN_TASKS) -> warm-up + ALL PASS, 39 at the last live run; HUMAN_TASKS item 1 UNKNOWN -> DONE (owner confirmed 002 and 003) with the monthly purge; "five small server functions" -> wording that cannot go stale; knowledge 16 TigerGraph row -> setup done, no auto-start; "did not wake" now only in dated history (PROGRESS, generated commit log) |
| DEPLOY | PASS | env table adds `USAGE_VERIFY_PER_DAY` (60), `RECEIPT_SIGNING_KEY`, `NEXT_PUBLIC_SITE_URL`; section 3 adds migration 003 and the monthly purge; NEXT_PUBLIC_ rule reworded |
| HUMAN_TASKS | PASS | rewritten to the real state: done items marked, routine after-push checks, keep TigerGraph awake, person-only UI checks incl. the clipboard, optional Q2 demo wallet |
| UI_CHECKLIST | PASS | rows 31-38: ledger (incl. Link graph row), I already paid, receipts and /verify, /patterns, share preview, graph timing note, link hint, /about counts; each marked verified (with the run) or person-only / live check G7 |
| SPEC | PASS | appended "TIGERGRAPH AND GRAPH UI DECISIONS (2026-10-30)"; older text untouched |

## G7 - Post-flight, push and live verification

| Criterion | Result | Evidence |
|---|---|---|
| Post-flight | PASS | `Tests 435 passed (435)`, typecheck 0, lint 0, build 0, `docs:check PASS`, eval `precision 100.0%, recall 100.0%, FP 0, FN 0` |
| Push | PASS | origin-only commits 0; `89ad467..76767c7  main -> main` (fast-forward, plain push) |
| Live build | PASS | 12:43:34 `"build":"76767c7"` = HEAD; `"receipts":true` |
| smoke-live | PASS | `warm-up check 1: ok (5 s)`, `ALL PASS (39 expectations)` |
| check-headers | PASS | `ALL PASS (48 checks)` |
| Live graph (TigerGraph awake) | PASS | `/api/graph`: `backend: 'tigergraph', elapsedMs: 609, nodes: 5, paths: 2`; `/api/graph/stats`: `{"backend":"tigergraph","vertices":22,"edges":21}` |
| Live browser | PASS | sample 1 High; hint "This UPI ID is linked to 4 other identifiers in community reports. Show links to see how." + "A link is not proof of wrongdoing." + demo label; note "Graph backend: tigergraph (654 ms)" (375 px: 614 ms); ledger "not looked up (press Show links)" -> "checked · tigergraph, 654 ms"; graph margins 466/42/477/29 at 1440 and 30/46/39/31 at 375, overflow false; /about "Right now the graph holds 22 vertices (identifiers and reports) and 21 links, counted by TigerGraph."; console [] |
| Screenshots | PASS | `docs/screens/live-graph-1440.png`, `live-graph-375.png`, `live-hint-1440.png`, `live-about-graph-1440.png` |

# Finish round (branch finish, 2026-10-30)

## H0 - Baseline and look reference

| Criterion | Result | Evidence |
|---|---|---|
| Identity, branch, remote | PASS | `Abin-Shaji-Thomas` / `<owner email>`; HEAD = origin/main = ccfffa6; branch `finish` |
| Gate | PASS | `Tests 435 passed (435)`, typecheck 0, lint 0, build 0, docs:check PASS |
| Live health | PASS | `"build":"ccfffa6"` = HEAD, `"graph":"tigergraph"`, `"receipts":true` |
| Old servers | DONE | a server on port 3000 (the owner's older localhost) was stopped; local production build on 3400 |
| Look reference (pre-056ab4b stack injected, 1440 px) | RECORDED | h1 `ArialMT` w300 86.4px 2 lines width 1001; h2 `ArialMT` w400 24px; lead `ArialMT` w400 18px; eyebrow `ArialMT` w400 14px; button `ArialMT` w400 14px; brand `Arial-BoldMT` w600 18px; risk word `ArialMT` w300 115.2px. Screenshots `docs/screens/finish-ref-home-1440.png`, `finish-ref-sample1-1440.png` |
| Live today (same elements) | RECORDED | h1 and risk word `SegoeUI-Light`; h2, lead, eyebrow, button `SegoeUI`; brand `SegoeUI-Semibold`; same sizes and widths (button 115 vs 122 px, brand 80 vs 90 px) |
| Other local vs live differences | ONE, timing only | /, /about, /patterns, /verify: text, header/footer links and computed styles identical. Sample 1: the linked-identifier hint appeared live after 3.4 s and locally after 13.1 s (slower first TigerGraph call from this machine); not a product difference |
| h1 wrap with Arial | NOTE | `["Evidence-linked scam","check for India."]` at 1280-1680 px; `["Evidence-linked scam check","for India."]` only at 1920 px. The owner's description of "scam check / for India." at 1440 matches today's Segoe UI Light layout, not Arial at today's sizes |

## H1 - Production looks like the owner's localhost

| Criterion | Result | Evidence |
|---|---|---|
| Stack and weights | PASS | `--font: Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif`; `.t-title`, `.t-risk`, `.t-404`, step numerals 300 -> 400 (`.t-h2` already 400); 600 rules unchanged; `font-synthesis: none` on the body; the graph canvas font uses the same stack |
| Reference vs new (5 widths x / and sample 1) | PASS | 75 values compared (font file, size, width, line count, h1 wrap): `differences: 0`; h1 `ArialMT` w400, risk word `ArialMT` w400 (48 / 61.44 / 102.4 / 115.2 / 128 px), brand `Arial-BoldMT` w600 |
| font-synthesis changes nothing | PASS | the reference had no `font-synthesis` and the font files match |
| Overflow and tap | PASS | overflow false, smallest tap target 44 px at all five widths on both pages; console [] |
| Test note | NOTE | the first comparison showed 429s: this machine had used its 40 daily checks on the local server; the comparison ran again with local-only `USAGE_CHECK_PER_DAY=1000` (not committed) |
| Tests | PASS | style.test.ts: new rule (Arial-first stack, only 400/600, no light weight, `font-synthesis: none`); ui.test.ts .t-404 and step numerals now 400 |

## H2a - Header links

| Criterion | Result | Evidence |
|---|---|---|
| Links and tap areas | PASS | NavLinks: /patterns, /verify, /about with min-h-11 min-w-11; brand at left; flex-wrap |
| aria-current | PASS | the current path gets aria-current="page" (render test with /verify) |
| Footer unchanged | PASS | footer still links /about, /patterns, /verify |
| 375 px browser check | see H2 browser pass | |

## H2b - Beyond the check band

| Criterion | Result | Evidence |
|---|---|---|
| Band content | PASS | three entries with the brief's sentences; N from RULES.length; links /patterns, /verify, /about; print:hidden; 3 x lg:col-span-4 |
| Placement | PASS (decision) | under the form while there is no result (render test asserts the order); after the result card once there is one |

## H2c - Share proof and Why? links

| Criterion | Result | Evidence |
|---|---|---|
| Share proof step | PASS | h3 "Share proof", the brief's sentence, Download signed receipt (button--outline), Open Verify (44 px), receipt code; only when result.receipt (render tests with and without) |
| Download moved | PASS | the button left the evidence pack button row; the old receipt sentence is replaced by the step |
| Why? links | PASS | /about#sources (anchor exists) after each not-applicable status and under Not checked; none on checked rows; kept out of the uppercase eyebrow |

## H2d - Pattern links and ?example=

| Criterion | Result | Evidence |
|---|---|---|
| Check a message | PASS | `.button` link to / under the /patterns intro, before the first rule (render test) |
| Try this example | PASS | one link per rule (18) to /?example=<rule_id>, 44 px |
| Server validation | PASS | `patternExample`: only ids in RULES with a guide entry; empty, unknown, case-changed, repeated and inherited keys rejected (tests) |
| Pre-fill, no auto-submit | PASS | textarea holds the example, note and demo label shown, Check enabled, no result rendered (test) |
| Prerender kept | PASS | the build first failed (searchParams outside Suspense under cache components); fixed with `<Suspense>` around `ExampleCheckForm`, the empty form as fallback; build lists `/` as partial prerender (shell static, form streamed); smoke and header checks re-run in H7 |

## H2e - /verify empty state

| Criterion | Result | Evidence |
|---|---|---|
| How to get a receipt | PASS | card shown while the box is empty: run a check, Download signed receipt under Share proof, paste the file; link home (render test) |
| Try an example | PASS | posts sample 3 to /api/check once, fills the box with the pretty receipt JSON (verifies with the test key); cost note on the page |
| No auto-verify | PASS | source test: tryExample only fills the box; one `void run()` (the Verify button) |
| Failures | PASS | no receipt, 429, 500, bad shape, network: one plain sentence each (tests) |

## H2f - One-time New line

| Criterion | Result | Evidence |
|---|---|---|
| Wording | PASS | the brief's sentence when a receipt exists; without "signed receipt" when none (it would otherwise name something absent) |
| Once per session | PASS | sessionStorage flag `scamlens:new-line-seen`; second claim false (tests) |
| try/catch | PASS | throwing, blocked and missing storage: no throw, line allowed, still once per page (ref) |
| Placement | PASS | under the badge, before What was checked; print:hidden (render test) |

## H2 browser check (local, headless Edge, 2026-10-30)

| Check | 375 | 1440 |
|---|---|---|
| Header: 4 links at 44 px, no horizontal overflow | PASS (links wrap to a second row, header bottom 136 px) | PASS (one row, 92 px) |
| /patterns: Check a message to /, 18 Try links at 44 px | PASS | PASS |
| Try this example (withdrawal_fee): box filled, note, demo label, no result, Check enabled | PASS | PASS |
| /?example=nope: empty box, no note | PASS | PASS |
| Beyond the check: 3 cards | PASS | PASS |
| Sample 3: New line on first result only (absent on 2nd check and after reload) | PASS | PASS |
| Share proof: sentence, Download button, Open Verify 44 px, receipt code | PASS | PASS |
| Why?: 7 links for 7 not-applicable rows, /about#sources | PASS | PASS |
| /verify: empty card with cost note; Try an example fills; Verify -> Signature valid (browser) | PASS | PASS |
| Console errors or warnings | none | none |

Screenshots: `docs/screens/finish-example-375.png`, `docs/screens/finish-result-1440.png` (with the two H0 reference shots, 4 finish-* files). The local server ran with raised daily limits through env only (not committed); the server's wrapper shell was once stopped for low memory, the server process itself kept running.

## H3 - Domain check (GoPlus phishing_site)

| Criterion | Result | Evidence |
|---|---|---|
| Probe | PASS | no key; phishing_site 1 for GoPlus's documented example domain, 0 for example.com and zz-demo-bonus-claim.example.com; 0.2-0.6 s |
| Built | PASS | `checkGoPlusPhishing`, source goplus_phishing, MAX_DOMAINS 5, only the domain sent (test asserts the URLs and that no message text is sent) |
| Failure rule | PASS | 500, GoPlus error code, HTML, timeout: unavailable with gopluslabs.io link (tests) |
| Risk | PASS | a listing is a verified match: High (test) |
| Coverage | PASS | new row "GoPlus phishing sites"; wallets are never listed as not looked up in it; Not checked says domains used this one list only |
| Receipts | changed | coverage in new receipts includes the goplus_phishing row; older receipts still verify (receipt coverage is free text, schema unchanged) |

## H4 - Evidence-path links by node id

| Criterion | Result | Evidence |
|---|---|---|
| Server gives ids | PASS | each path has `edges` (node-id pairs): Q1 from wallet_hash/telegram_hash, Q2 from `path`, Q3 wallet-to-Telegram links by id and type |
| UI matches by id | PASS | `onEvidencePath` (edges.ts); GraphPanel no longer reads path text (source test) |
| Label collision | PASS | two nodes with the same masked label: only the path link is highlighted (test; the old logic lit both) |
| Seeded data | PASS | every Q1/Q2/Q3 edge is a real link of the view; highlighted links = path edges (Q1 4, Q3 3) |
| Browser-safe | PASS | edges.ts has no server imports; GraphPanel imports only types from view.ts |

## H5 - 7-day usage total

| Criterion | Result | Evidence |
|---|---|---|
| Route | PASS | GET /api/usage-stats -> {checks, days: 7, asOf}; connection(); 404 + no-store on no db or failure |
| Sum | PASS | only `fp:<hash>:check` keys, today and the 6 days before (UTC); other routes, global:llm, older and future days excluded (tests, including the real table in PGlite with a denied call) |
| No keys out | PASS | response keys are exactly asOf, checks, days (test) |
| Cost | PASS | 5-minute cache (test: 1 read per 5 minutes) and s-maxage=300 |
| /about line | PASS | the brief's sentence, in the privacy section, omitted on failure |
| Live read | not verified yet | depends on the service-role read of usage_counters on Supabase; checked in H7 |

## H6 - Stale-doc audit and drift tooling

| Criterion | Result | Evidence |
|---|---|---|
| Extra docs checked | PASS | `checkExtraDocs` over README, DEPLOY, HUMAN_TASKS, UI_CHECKLIST: facts, generated blocks, relative links (from each doc's folder); docs:generate rewrites them too |
| New facts | PASS | rule_count (README, UI_CHECKLIST, HUMAN_TASKS), smoke_expectations 39 (DEPLOY, HUMAN_TASKS, 13), db_migrations and graph_migrations (HUMAN_TASKS) |
| Smoke count from code | PASS | expectation lists moved to `scripts/smoke-expectations.ts`; `smokeExpectationCount(true)` = 39, false = 36; smoke-live adds a FAIL when fewer ran |
| STALE_PHRASES.json | PASS | 11 phrases with why and since; history docs exempt; case-insensitive; reports doc:line |
| Audit | PASS | found and fixed "website domains were not checked against a blocklist" in 19; no other listed phrase in any checked doc |
| HUMAN_TASKS | PASS | rewritten in current order: wake TigerGraph, after-push checks, monthly purge, recreate-only SQL, person-only checks (adds Share proof download and Try this example), optional |
| Tests | PASS | docs.test.ts: extra docs clean, facts present, new facts from code, checker catches a stale fact and a broken link, stale phrases clean and caught |

## H7 - Second gate (local)

| Check | Result | Evidence |
|---|---|---|
| npm test x3 | PASS | 480/480, 480/480, 480/480 |
| typecheck, lint, build, docs:check | PASS | 0 / 0 / 0 / PASS |
| eval | PASS | precision 100.0%, recall 100.0%, FP 0, FN 0 |
| local smoke | PASS | ALL PASS (39 expectations) |
| scenarios | PASS | 13 + 4 error paths; domain demo Low/no_match, phishing example High/match |
| pages 5 x 6 | PASS | no overflow, Arial 400, 44 px nav, no console errors |
| H2 flow re-run | PASS | 375 and 1440 |
| usage-stats | PASS | 129 checks from Supabase |

## H7 - Live

| Check | Result | Evidence |
|---|---|---|
| push | PASS | ccfffa6..62e71ca main -> main |
| health | PASS | build 62e71ca after ~60 s |
| smoke-live | PASS | ALL PASS (39 expectations) |
| check-headers | PASS | ALL PASS (48 checks) |
| parity local vs live | PASS | 30 rows, 0 diffs, 0 console errors |
| look parity vs reference | PASS | 39 typography values x 5 widths identical; h1 wraps identical |
| screenshots | PASS | 6 live-*.png replace the 10 earlier ones |


# Final round (branch `final`, 2026-10-30)

## P0 - Baseline and state discovery

| Check | Result | Evidence |
|---|---|---|
| Identity | PASS | `Abin-Shaji-Thomas` / owner email (configured; not written into files) |
| Branch | PASS | `final` from main = origin/main = fb7874e |
| Gate | PASS | 480 tests, typecheck 0, lint 0, build 0, docs:check PASS |
| Live health | PASS | `"build":"fb7874e"` = HEAD; receipts true, graph tigergraph, llm false |

| Item | State |
|---|---|
| Header links Patterns / Verify a receipt / About (44 px, aria-current) | already done (519d17b) |
| Home "Beyond the check" band | already done (1103255) |
| "Share proof" step | already done (4a68571) |
| "Try this example" on /patterns, `?example=` validated server-side | already done (65ee1da) |
| /verify "How to get a receipt" and "Try an example" | already done (60fa30f) |
| One-time "New:" line | already done (46c0819) |
| Domain row (GoPlus phishing sites) | already done (c2036ca) |
| /api/usage-stats | done (c33f432); P7 asks for a 10-minute cache and only `{checks, days}`: to change |
| docs/knowledge/STALE_PHRASES.json | done as plain phrases (02d8955); P8 asks for regexes: to extend |
| web/src/lib/contact.ts, footer contact | missing |
| web/src/app/icon.svg | exists |
| Personal email in files | found 6 times in this file (history rows); replaced with `<owner email>`. Older commits still contain it (pushed history is not rewritten) |

## P1 - Look parity

Reference: localhost:3000 did not answer, so `0f00ca8` (the commit before 056ab4b) was built in a temporary worktree outside the repo (its own `npm ci` from the same lockfile; Turbopack, as the app's Tailwind loader needs) on port 3500, then removed. Captured with headless Edge: `CSS.getPlatformFontsForNode` plus computed family, weight, size, line-height, letter-spacing, transform, decoration and colour for body, brand, header links, h1, .lead, .eyebrow, textarea, primary button, sample links, .t-risk, .t-h2, tier titles, finding titles, small text and footer, on /, after sample 1 and on /about, at 1440 and 375.

| Comparison | Result |
|---|---|
| reference vs local vs live, 576 values | 518 SAME; 58 differ, all explained below |
| platform font, every selector, every page, both widths | Arial in all three (reference too: Windows maps "Helvetica Neue"/Helvetica to Arial) |
| h1 lines / width | 2/1001 at 1440 and 3/335 at 375 in all three; /about 1/1001 and 1/335 |
| h1 rendered pixels (SHA-256 of the h1 box) | identical in reference, local and live at 1440 and at 375 |
| h1 and .t-risk weight | reference 300, now 400: Arial has no light face on Windows, so both draw the same regular Arial (pixels identical); on macOS the reference would have drawn Helvetica Neue Light, which the owner does not want, so 400 stays |
| header links (40 of the 58) | new element since the reference (finish round); Arial 400, 18 px, 44 px tap areas |
| .t-risk colour after sample 1 | content, not style: the reference build ran without the database, so sample 1 was Elevated (black); local and live are High (alert red) |
| overflow | none on any page at 1440 or 375 |
| live CSS | `--font: Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif`; font-weight declarations only 400, 600, bolder, inherit, initial; no 300 |

Root cause of the earlier "thin headings" report: 056ab4b put Segoe UI before Helvetica with weight 300, which drew Segoe UI Light on Windows; e0add7c (finish round) restored the Arial-first stack at 400. Nothing else differs, so no code change in P1. Screenshots: `docs/screens/look-ref-home-1440.png`, `look-ref-home-375.png`, `look-ref-sample1-1440.png`.

## P2 - Identifier and scenario correctness

| Check | Result | Evidence |
|---|---|---|
| EIP-55 | PASS | spec page opened: the "Normal" vector is `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed` (lowercase f); accepted as checksum; the brief's `...E7EF1BeAed` is that vector with one case flipped and is rejected; all-caps and all-lowercase spec vectors accepted as "format" (new tests) |
| TRON, BTC, bech32 | PASS | existing official vectors; last-character and one-character flips rejected |
| UPI vs email, phone, Telegram, domains | PASS | dot after @ = email; +91 and 6-9 start, 10 digits (5-start and 9 digits rejected, new test); @name 5-32 and t.me; registrable ICANN hostnames only |
| 12 QA scenarios | PASS | identifiers 12/12, levels 12/12 offline and on the server; 1 BUG fixed (task_earn word order), 5 differences BY DESIGN (`eval/qa-scenarios.md`) |
| eval | PASS | 83 cases (p01-p03 appended), precision 100.0%, recall 100.0%, FP 0, FN 0 |
| ReDoS | PASS | worst 4.9 ms, 0 cases >= 200 ms |
| Levels explained on the card | PASS | "What the levels mean" with the three sentences and RISK_CEILING_NOTE (render test) |

## P3 - Community data layer (migration 004)

| Check | Result | Evidence |
|---|---|---|
| Migration 004 | PASS (local) | `web/db/migrations/004_cases_and_feedback.sql`: cases, feedback, 6 functions (security definer, empty search_path, service role only), RLS; idempotent; PGlite runs schema + 002-004 |
| Before 004 | PASS | writes return "cases_unavailable" (route 503 "Contributing is not available right now."), reads empty; checks unaffected (test with `migrations: false`) |
| 2-reporter rule via cases | PASS | one case: not shown; second network: shown with 2 reporters (test) |
| Delete code | PASS | 128 bits, HMAC only; wrong or malformed code deletes nothing; right code deletes case and excerpt; "also remove my reports" removes reports and links (test) |
| Purge | PASS | expired case, orphan excerpt, 91-day feedback removed (test) |
| Feedback | PASS | one answer per network per identifier; rules key without identifiers; counts display only (test) |
| Trail summary | PASS | only after 2 reporters; synthetic and real apart; no excerpt, fingerprint or case id (test) |
| Excerpt never returned | PASS | responses of all three routes and every log line scanned; only the migration mentions the column (test) |
| Limits | PASS | USAGE_CASE_PER_DAY 5, USAGE_FEEDBACK_PER_DAY 30, 429 with Retry-After (test) |
| Live Supabase | HUMAN STEP | run `web/db/migrations/004_cases_and_feedback.sql` in the Supabase SQL editor |
