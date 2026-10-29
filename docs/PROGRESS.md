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
