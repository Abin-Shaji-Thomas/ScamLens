# ScamLens audit (STEP 0, 2026-10-29, commit 0dcfcbf)

Read-only audit before F1. Severity: HIGH / MED / LOW. Fixes are tracked in docs/PROGRESS.md.

## A. Compliance

| Check | Finding | Evidence |
|---|---|---|
| Identifiers only from the extractor | Yes. Client-supplied identifiers are re-validated through the extractor; the AI returns only `{rule_id, quote}` | `web/src/lib/check.ts:18`, `web/src/lib/reports/service.ts:23-26`, `web/src/lib/signals/validate.ts:46-57` |
| Quotes substring-verified, unknown rule ids dropped | Yes; quotes are re-cut from the input | `validate.ts:53-56`; tests in `signals.test.ts` |
| Raw text / quote / transcript / screenshot stored or logged | Not stored or logged: no `console.*` in `web/src`; `/api/check` persists nothing; reports store HMAC + masked display only; there is no report note field. Quotes appear only in the response and the client-side evidence pack (copied by the user, never sent to the server). No logging test exists | `git grep console. -- web/src` (none); `service.ts:33` |
| HMAC + masking of phone/UPI/email | Report and graph data: yes. `/api/check` returns the user's own identifiers unmasked (their own input, by design) | `privacy.ts:11`, `mask.ts:7`, `service.ts:33,65,86` |
| Banned words in user-facing strings | None found; only a test mentions "scammer". No test scans all strings (**MED**, F1) | `git grep -niE "scammer\|fraudster\|criminal\|guilty\|confirmed scam"` |
| Wording that implies accusation | Q3 path text "were reported asking **victims** to pay this wallet" presumes wrongdoing (**LOW**) | `web/src/lib/graph/view.ts` (Q3 branch) |
| "No reports does not mean safe" | Shown when the reports DB answers and has no entry; replaced by "Reports database unavailable ... not a clean result" when the DB is down | `risk.ts:59`, `ReportedList.tsx`, `tiers.ts:23` |
| Unavailable sources never clean | Correct: every source error becomes `unavailable` and adds "result is incomplete"; TigerGraph failure falls back to Postgres with a label | `verified/index.ts:15-21`, `graph/view.ts` |
| Service-role key server-only | Yes; read only in `reports/db.ts:66`; no client component imports server modules | git grep |
| `NEXT_PUBLIC_` misuse | None | git grep |
| `dangerouslySetInnerHTML` | None | git grep |
| SQL independence rule | Two reports are independent when their `reporter_fingerprint_hash` differs; one fingerprint counts once per identifier (`unique (identifier_hash, reporter_fingerprint_hash)`); badge needs `count(distinct reporter_fingerprint_hash) >= 2` within 90 days and no contest | `db/schema.sql:16`, `:108-112` |
| What the fingerprint contains | HMAC(pepper, client IP from `x-forwarded-for` + User-Agent) | `service.ts:91-94`, `privacy.ts:18` |
| Can one person trivially create two? | **Yes (MED)**: changing the User-Agent string yields a new fingerprint from the same IP | same |
| Graph links and independence | **HIGH**: graph links (Q1/Q3) only require different *submissions*, so one person filing two reports can create a "linked" path | `schema.sql:86-95`, Q1 `submission_id is distinct from` |
| Contest endpoint | **HIGH**: unauthenticated and unlimited; anyone can hide any badge | `api/report/contest/route.ts`, `schema.sql:116-120` |

## B. Env names

| Name | In .env.example | Read by code | .env.local |
|---|---|---|---|
| ETHERSCAN_API_KEY | yes | verified/etherscan.ts | SET |
| ETHERSCAN_PLAN | yes | verified/etherscan.ts | MISSING |
| ETHERSCAN_RPS | yes | verified/etherscan.ts | MISSING |
| GRAPH_HUB_MAX | yes | graph/index.ts | MISSING |
| OPENAI_API_KEY | yes | signals/llm.ts, eval/run.ts | MISSING |
| OPENAI_BASE_URL | yes | signals/llm.ts | MISSING |
| OPENAI_MODEL | yes | signals/llm.ts | MISSING |
| REPORTS_MAX_PER_DAY | yes | reports/service.ts | MISSING |
| REPORT_HASH_PEPPER | yes | graph/view.ts, reports/service.ts, scripts/graph-demo.ts | SET |
| SUPABASE_ANON_KEY | yes | **unused** | SET |
| SUPABASE_SERVICE_ROLE_KEY | yes | reports/db.ts | SET |
| SUPABASE_URL | yes | reports/db.ts | SET |
| TG_GRAPH / TG_HOST / TG_SECRET | yes | graph/index.ts | SET |
| TRONGRID_API_KEY | yes | verified/tron.ts | MISSING |

No name is read by code without being in `.env.example`. `SUPABASE_ANON_KEY` is unused.

## C. Eval (before F5)

40 synthetic cases (20 scam / 20 normal), regex-only (no LLM key). Precision 83.3 %, recall 100 %, accuracy 90 %. False positives:

| id | Excerpt | Rule | Why |
|---|---|---|---|
| n05 | "Amazon: ... Share OTP 4821 with the delivery agent only..." | otp_pin_request | A genuine delivery OTP instruction has the same shape as an OTP request |
| n06 | "Guys I made a Telegram group for the project notes..." | move_platform | "Telegram group" alone fires |
| n09 | "...Past returns do not guarantee future returns." | guaranteed_returns | No negation guard on this rule |
| n18 | "Let's continue planning the trip on WhatsApp..." | move_platform | "continue ... on WhatsApp" fires with no other risk context |

## D. Abuse surface

| Route | Input cap | Rate limit | Max external calls / request | Worst case | Dependency down |
|---|---|---|---|---|---|
| POST /api/check | 20 000 chars, 10 addresses | **none (MED)** | GoPlus ≤10, Etherscan 15 + ≤15 retries (first EVM wallet), TronGrid ≤10, Supabase 1, LLM 0-1 | ~8-20 s function time; free-quota exhaustion | per-source `unavailable` + "result is incomplete" |
| POST /api/report | 10 identifiers x 200 chars | 5 / fingerprint / day (SQL, non-atomic, LOW) | Supabase 1, TigerGraph 2 | small | 503; TigerGraph failure reported as `graph: "sync failed"` |
| POST /api/report/contest | 200 / 500 chars | **none (HIGH)** | Supabase 1 | hides any badge | 503 |
| POST /api/graph | 200 chars | **none (MED)** | TigerGraph ≤4 or Supabase ≤4 | small | Postgres fallback, else `unavailable` |
| GET /api/health | - | none | 0 | - | - |

Body size: routes call `request.json()` without a raw size check (LOW: Vercel caps bodies at 4.5 MB).

**ReDoS** (`npx tsx scripts/redos-check.ts`): 56 functions/regexes x 20 adversarial 6000-char inputs (runs of `@`, `.`, base58, `T`, `1`, hex, bech32, digits, spaces, newlines, emoji, Devanagari, keyword salad, URL fragments). Worst case **3.7 ms** (`runRules` on emoji); **0 cases >= 200 ms**.

## E. UI

- One page `/`; no `/about`. Loading: "Checking..." button state, graph "Loading...". Error: red text for /api/check failures; graph/report/contest `fetch` failures are **not caught** (LOW). Empty: tier empty texts, "Paste something and press Check". No "waking up" state for the graph.
- 375 px: unverified in a browser. Code: `max-w-2xl` + `px-4`; **graph canvas fixed `width={600}`** inside `overflow-hidden` gets clipped (MED).
- No `aria-live` on results; tiers also distinguished by text titles, not colour alone.

## F. Promised but not built

- Form copy and README say you can paste "screenshot text"; true for pasted *text*, but no image upload exists (F3).
- README Limitations claims "Contest has no review queue" (accurate) and "Fingerprints are approximate (hashed IP + user agent)" (accurate).
- SPEC env list includes `SUPABASE_ANON_KEY`, which is never used.
