# ScamLens evaluation results

**Illustrative demo data**: every chat in `eval/chats.json` is synthetic and hand-written for this project.

- Date: 2026-10-29T18:00:25.526Z
- Git commit: e96bdbb (with uncommitted changes)
- Cases: 74 (37 scam / 37 normal; 31 normal cases are deliberately tricky)
- Modes run: regex-only. with-AI: not run (OPENAI_API_KEY / OPENAI_MODEL not set)
- Command: `cd web && npm run eval`

## Text signals

### Mode: regex-only

| metric | value |
|---|---|
| accuracy | 98.6% |
| precision | 97.4% |
| recall | 100.0% |
| false positives | 1 of 37 normal |
| false negatives | 0 of 37 scam |
| TP / FP / TN / FN | 37 / 1 / 36 / 0 |

False positives: v01 (bank_advisory) <- urgency_deadline

False negatives: none

Per rule (a hit counts when the rule fired on a chat whose hand label includes it; precision = correct firings / all firings, recall = correct firings / chats labelled with the rule):

| rule | labelled | fired | correct | precision | recall |
|---|---|---|---|---|---|
| guaranteed_returns | 4 | 4 | 4 | 100.0% | 100.0% |
| withdrawal_fee | 8 | 8 | 8 | 100.0% | 100.0% |
| urgency_deadline | 11 | 12 | 10 | 83.3% | 90.9% |
| seed_phrase_request | 3 | 3 | 3 | 100.0% | 100.0% |
| otp_pin_request | 4 | 4 | 4 | 100.0% | 100.0% |
| move_platform | 4 | 4 | 4 | 100.0% | 100.0% |
| remote_access_app | 3 | 3 | 3 | 100.0% | 100.0% |
| authority_impersonation | 5 | 5 | 5 | 100.0% | 100.0% |
| digital_arrest | 5 | 4 | 4 | 100.0% | 80.0% |
| fake_kyc | 4 | 4 | 4 | 100.0% | 100.0% |
| fake_refund | 3 | 3 | 3 | 100.0% | 100.0% |
| task_earn | 4 | 4 | 4 | 100.0% | 100.0% |
| romance_investment | 3 | 3 | 3 | 100.0% | 100.0% |
| third_party_account | 3 | 2 | 2 | 100.0% | 66.7% |
| small_amount_first | 6 | 6 | 6 | 100.0% | 100.0% |
| fake_profit_proof | 5 | 5 | 5 | 100.0% | 100.0% |
| prize_lottery | 3 | 3 | 3 | 100.0% | 100.0% |
| utility_disconnection | 3 | 3 | 3 | 100.0% | 100.0% |

## Identifier extraction

| metric | value |
|---|---|
| hand-listed identifiers | 6 |
| extracted | 6 |
| precision | 100.0% |
| recall | 100.0% |

Errors: none

## What this evaluation is NOT

These are hand-written synthetic cases, many written by the same person who wrote the rules, so the numbers
are optimistic and say little about real-world performance. This is not a benchmark of real scams: there are
no real chats, no real victims' messages and no independent labelling. The set is small (a few dozen cases),
English-first with a handful of Hinglish lines, and the per-rule numbers rest on two to six examples each.
Use it as a regression check (did a change break a known case?), not as evidence that ScamLens catches a
given share of scams.
