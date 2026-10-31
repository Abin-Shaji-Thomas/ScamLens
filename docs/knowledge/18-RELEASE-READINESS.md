# Release readiness

## In plain words

The final quality gate, run on 2026-10-30 against `npm run build` + `npm run start` on the owner's machine with the real keys (Supabase, Etherscan, TigerGraph host, receipt signing key; no AI key, by the owner's decision). Every row says PASS, FAIL or UNKNOWN with the evidence. One real failure was found and fixed (a 16 px tap target); TigerGraph could not be woken and stays a human task.

## Details

### Summary matrix
| Area | Result | Evidence |
|---|---|---|
| Scenarios through the real check path | PASS | 13 scenarios plus 4 error paths, table below |
| Failure injection | PASS | bad Etherscan key, unreachable Supabase and TigerGraph: every source shown as unavailable, never clean; no "No known reports" claim; graph `status: "unavailable"` |
| Daily-limit path | PASS | `USAGE_CHECK_PER_DAY=1`: second check `429` in 18 ms with `Retry-After`; no external call (also proved by the unit test in `web/src/lib/usage.test.ts`) |
| Graph asleep | PASS (fallback) | TigerGraph does not auto-start; `/api/graph` answers from Postgres, labelled `postgres (TigerGraph unavailable)`; the page works |
| Privacy audit | PASS | `console.*` only in `web/src/lib/log.ts`; every `logEvent` carries status/duration only; receipts hold no quote, chat word or full identifier (test); `/api/health` returns booleans/short statuses only |
| Performance (rules only, real sources) | PASS | 10 checks cycling samples 1-3: p50 1,118 ms, p95 3,605 ms (Etherscan cache warm; the first cold sample 2 took 10.6 s) |
| Browser: 5 widths x 6 pages | PASS after one fix | no horizontal overflow; grid box 100 / 100 / 91.7% of the window at 1280 / 1440 / 1920; smallest tap target 44 px (was 16 px for the inline /verify link, fixed); console empty except the 404 page's own status |
| Keyboard focus | PASS | 2 px black outline on every stop (home: earlier round; /verify: ScamLens, About, both text areas, footer links) |
| "I already paid" | PASS | 7 steps in order, 4 fields, draft with identifiers and amount; page network requests while editing and copying: 0 |
| Coverage ledger | PASS | rows and "Not checked" line correct at 1440 and 375 px, no overflow |
| Receipt download and /verify | PASS | download `scamlens-receipt-m6h93wD4Q7UW.json`; genuine receipt: "Signature valid: ScamLens produced this receipt at 2026-10-30T02:31:47.452Z and it has not been altered...", "Checked in your browser with the published key."; tampered (risk level edited): "Signature not valid..." |
| Print preview | PASS | text colours only `rgb(0, 0, 0)`; ledger printed; paid plan hidden |
| 200% zoom at 1280 | PASS | `/` and `/patterns`: no overflow, same text length |
| Reduced motion | PASS (by CSS) | global `prefers-reduced-motion` rule (measured `0s` in the UI round); new components add no animation (style test) |
| Tests, typecheck, lint, build, docs:check, eval | PASS | `Tests 402 passed (402)`, typecheck 0, lint 0, build 0, `docs:check PASS`, eval `precision 100.0%, recall 100.0%, FP 0, FN 0` |
| AI mode | NOT APPLICABLE | off by the owner's decision; zero model calls; UI and docs say rules only |

### Live verification after the push (2026-10-30)
| Check | Result | Evidence |
|---|---|---|
| Push | PASS | `9e95b19..f201b16  main -> main` (fast-forward) |
| Live build | PASS | `/api/health` `"build":"f201b16"` about 45 s after the push; `"receipts":true` (the Vercel key parses) |
| smoke-live | PASS | `ALL PASS (39 expectations)`, including "signed receipt verifies with the published key" for all three samples |
| check-headers | PASS | `ALL PASS (48 checks)` |
| Live browser | PASS | `/`, sample 1, `/patterns`, `/verify`, `/about`: no overflow, 44 px tap targets, no console messages; sample 1 High 3/3; ledger 7 rows; paid plan 7 steps, 0 requests while editing and copying; downloaded receipt verified in the browser, tampered copy rejected; print black only. Screenshots `docs/screens/live-*.png` (6) match the local ones |

### Scenarios (real check path, 2026-10-30)
| Scenario | Risk | Verified | Reported | Suspected (w = warning context) | Receipt |
|---|---|---|---|---|---|
| Sample 1 (digital arrest) | High | – (UPI only) | ok, 1 entry | authority_impersonation, digital_arrest, urgency_deadline | yes |
| Sample 2 (sanctioned wallet) | High | ofac match, scamsniffer no_match, goplus match, etherscan info x3, 2 chains not on plan | ok, 0 | guaranteed_returns, fake_profit_proof, small_amount_first, move_platform | yes |
| Sample 3 (bank alert) | Low | – | ok, 0 | – | yes |
| EVM wallet only | Low | ofac, scamsniffer, goplus no_match; etherscan info x3 | ok, 0 | – | yes |
| TRON address only | Low | ofac, goplus no_match; trongrid info | ok, 0 | – | yes |
| UPI ID only | Low | – | ok, 0 | – | yes |
| Phone number only | Low | – | ok, 0 | – | yes |
| Telegram handle only | Low | – | ok, 0 | – | yes |
| Obfuscated scam (spaced letters, emoji) | Elevated | – | ok, 0 | otp_pin_request, fake_kyc | yes |
| Hinglish scam | Elevated | – | ok, 0 | task_earn, urgency_deadline | yes |
| Benign bank OTP alert | Low | – | ok, 0 | – | yes |
| News-style warning | Low | – | ok, 0 | fake_kyc (w), urgency_deadline (w), otp_pin_request (w) | yes |
| Mixed text with a decoy warning | Elevated | – | ok, 0 | fake_profit_proof, guaranteed_returns, withdrawal_fee | yes |
| Empty input | HTTP 400 | "Please paste some text to check." | | | |
| Oversize input (20,000 chars) | HTTP 413 | "That is too long. Please paste at most 6,000 characters." | | | |
| Invalid image | HTTP 400 | "That file does not look like a PNG, JPEG or WebP image." | | | |
| Image while AI is off | HTTP 503 | "Screenshot reading is off. Paste the text instead." | | | |

### Screenshots (`docs/screens/final-*.png`, 12)
`final-home-375`, `final-sample1-375`, `final-sample1-1440`, `final-sample1-1920`, `final-ledger-1440` (full result page: ledger, tiers, paid plan open with the draft), `final-paid-1440`, `final-print-1440`, `final-verify-1440` (valid result), `final-verify-375`, `final-patterns-1440`, `final-patterns-375`, `final-about-1920`. What they show: the 12-column layout as in the UI round; "What was checked" as a two-column section after the risk header; the paid plan inside the beige band with large light numerals; the footer with Patterns and Verify links.

### Second gate (finish round, branch finish, 2026-10-30)
Local `npm run build` + `next start` with the real keys (no AI key), daily limits raised through env for the run only.

| Check | Result | Evidence |
|---|---|---|
| `npm test` x3 | PASS | 33 files, `Tests 480 passed (480)` on each of the three runs |
| typecheck, lint, build, docs:check | PASS | 0, 0, 0, `docs:check PASS`; build lists `/` as partial prerender |
| eval | PASS | `regex-only: precision 100.0%, recall 100.0%, FP 0, FN 0`; identifiers 100.0% / 100.0% |
| smoke-live (local) | PASS | `ALL PASS (39 expectations)` |
| API scenarios | PASS | the 13 scenarios and 4 error paths of the table below give the same levels and messages (samples 2 and 3 through smoke-live) |
| Domain check (H3) | PASS | demo domain: Low, `goplus_phishing:no_match`; GoPlus's documented phishing example: High, `goplus_phishing:match`; the domain notice on both |
| /api/usage-stats (H5) | PASS | `{"checks":129,"days":7}` from the real Supabase table (service-role read works; the number includes our testing) |
| Pages: 5 widths x 6 pages | PASS | /, /about, /patterns, /verify, 404, /?example=fake_kyc at 375, 768, 1280, 1440, 1920: no overflow, h1 Arial 400, header links 44 px, no console errors; /about shows the usage line and "... counted by TigerGraph." |
| Discoverability flow (H2) | PASS | at 375 and 1440: 18 Try links, example pre-fill without a check, invalid id empty, New line on the first result only, Share proof, Why? 8 of 8 not-applicable rows (GoPlus phishing sites adds one), /verify Try an example then "Signature valid" |
| TigerGraph | PASS (awake) | /about stats counted by TigerGraph during the run |

### Live verification after the finish-round push (2026-10-30)
| Check | Result | Evidence |
|---|---|---|
| Push | PASS | `ccfffa6..62e71ca  main -> main` (fast-forward from branch finish) |
| Live build | PASS | `/api/health` `"build":"62e71ca"` about 60 s after the push; `"receipts":true`, `"graph":"tigergraph"`, `"llm":false` |
| smoke-live | PASS | `ALL PASS (39 expectations)` (warm-up ok in 2 s) |
| check-headers | PASS | `ALL PASS (48 checks)` |
| New features live | PASS | `/api/usage-stats` `{"checks":173,"days":7}` (includes our testing); `/?example=fake_kyc` 200 and pre-filled; GoPlus's documented phishing example High with `goplus_phishing:match` |
| Local vs live, 5 widths x 6 pages | PASS | 30 rows, 0 differences (overflow, h1 text, font, weight, header link heights, small targets, console errors, example pre-fill); 0 console errors live; /about "... counted by TigerGraph." |
| Look parity | PASS | against the owner-look reference: 39 typography values per width (family, weight, size) identical at 375, 768, 1280, 1440, 1920; h1 wraps identically (3, 2, 2, 2, 2 lines); remaining differences are this round's new content (the first h2 on / is "Beyond the check"; the result page is longer) |
| Screenshots | PASS | 6 live screenshots at the time (replaced again in the final round, see below) |

### Final gate (final round, branch final, 2026-10-31)
Local `npm run build` + `next start` with the real keys (no AI key); daily limits raised through env for the run only; a second server with an unreachable `TG_HOST` for the fallback.

| Check | Result | Evidence |
|---|---|---|
| `npm test` x3 | PASS | 40 files, `Tests 548 passed (548)` on each of the three runs |
| typecheck, lint, build, docs:check | PASS | 0, 0, 0, `docs:check PASS` |
| eval | PASS | 83 cases: `precision 100.0%, recall 100.0%, FP 0, FN 0`; identifiers 100.0% / 100.0% |
| QA scenarios (eval/qa-scenarios.json) | PASS | levels 12/12 offline and on the server; rule differences classified in eval/qa-scenarios.md (1 bug fixed, 5 by design) |
| Contribution flow | PASS in PGlite; live database: unavailable as designed | route tests: consent, case, delete code once, delete by code, reports removed on request, excerpt never returned or logged; on localhost against Supabase (no migration 004): "Contributing is not available right now." |
| Scam trail, TigerGraph reachable | NOT VERIFIED today | the Savanna workspace was suspended (`/restpp/echo` HTTP 500); the trail answered from Postgres, labelled "postgres (TigerGraph unavailable)", in 1.7 s. On 2026-10-30, awake: 0.6-1.8 s and parity 63/63 SAME |
| Scam trail, TigerGraph unreachable (`TG_HOST` invalid) | PASS | "postgres (TigerGraph unavailable)", 1.2 s, no notice, level Elevated as expected |
| Pages: 5 widths x 7 pages | PASS | /, /about, /patterns, /verify, 404, /?example=fake_kyc, /privacy at 375, 768, 1280, 1440, 1920: no overflow, h1 Arial 400, header links 44 px, no console errors |
| Keyboard | PASS | Tab order on /: brand, Patterns, Verify a receipt, About, the box, the 3 samples, "Where these come from", the common-scam examples; 2 px outline on each |
| Print | PASS | header, common scams, feedback and contribute panels hidden; risk word, ledger and the footer contact address printed |
| 200% zoom (1280 px window) | PASS | /, /about, /privacy, /patterns: no horizontal overflow |

### Live verification after the final-round push (2026-10-31)
| Check | Result | Evidence |
|---|---|---|
| Push | PASS | `4cb8b46..175ccf0` and `175ccf0..c31652b` to main (fast-forward) |
| Live build | PASS | `/api/health` `"build":"c31652b"`, receipts true, llm false |
| smoke-live, check-headers | PASS | `ALL PASS (39 expectations)`, `ALL PASS (48 checks)` (before and after the fix) |
| Look parity | PASS | 14 selectors x 2 widths: 24 SAME; the 4 differences are the reference's weight 300 (drawn as the same regular Arial on Windows) and the risk word's colour (High vs Elevated, content); h1 lines and widths identical; h1 pixels identical to the reference (SHA-256 9a1b5c07aaf8 at 1440, 23d2954857e7 at 375) |
| Header and footer | PASS | 5 pages x 375 and 1440: Patterns, Verify a receipt, About at 44 px with aria-current; Contact mailto and the X link (new tab, noopener noreferrer) at 44 px; no overflow |
| Home examples | PASS | 5 named examples; "Digital arrest" fills the box, labelled, no check runs |
| Scam trail on a seeded campaign identifier | PASS (fallback only) | TigerGraph was suspended: first live check showed "tigergraph, timed out" (bug, fixed in c31652b); after the fix "postgres (TigerGraph unavailable)" in 0.5-2.3 s with the Scam trail section and "all illustrative demo data". Live TigerGraph not verified on 2026-10-31; on 2026-10-30, awake: 0.7-1.7 s |
| Result panels | PASS (UI); contributing UNKNOWN | "Was this right?" and "add it to the map" shown on a real result; the live database has no migration 004, so the end-to-end contribution was not run on live (no synthetic test case added) |
| /about | PASS | "Checks run in the last 7 days: 273 (includes our own testing)...", graph counts from the Postgres copy (TigerGraph unavailable), 5 scam-type sources, Contact with the 1930 line |
| Console | PASS | no errors |
| Screenshots | PASS | the live set replaced: `docs/screens/live-home-375.png`, `live-result-375.png`, `live-privacy-375.png`, `live-about-1440.png`, `live-trail-1440.png` |

### UNKNOWN (needs a person)
- Clipboard copy of the complaint draft (headless Edge blocks the clipboard, so the on-page fallback was what ran).
- Hover colours, screen reader announcements, real phones, macOS font weight.
- TigerGraph stays awake only while the Savanna workspace is resumed (no auto-start); parity was 19/19 SAME in the TigerGraph finish round.

## Where in the code

- `docs/PROGRESS.md`: raw evidence per step.
- `docs/screens/`: screenshots.
- `web/scripts/smoke-live.ts`, `web/scripts/check-headers.ts`: live checks (J8).

## How to change it safely

Re-run the affected check after every fix and update its row with the real output line.

## How it is tested

By the gate itself; the browser runs used headless Microsoft Edge over the DevTools protocol (a throwaway script outside the repo).

## Known limits

The scenario run uses the reports database as it is (mostly labelled demo data); performance depends on Etherscan's cache and rate limit.
