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
| Identity | PASS | `Abin-Shaji-Thomas` / `abinshajiabin2006@gmail.com`; branch `ui-swiss` from `main` (= `origin/main` at c860f73) |
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
