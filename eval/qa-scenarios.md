# QA scenarios: hypotheses vs results

Run on 2026-10-30 (final round P2) with `cd web && npx tsx scripts/qa-scenarios.ts http://localhost:3400`: every scenario in `eval/qa-scenarios.json` through `runCheck` offline (no network, no database) and through a local production server with the real sources. All identifiers are synthetic (see the JSON description). Illustrative demo data.

Identifiers matched the hypothesis in all 12 scenarios, and the level matched in all 12, offline and on the server. The differences were in which rules fired:

| # | Scenario | Level (expected / result) | Rule difference | Verdict |
|---|---|---|---|---|
| q01 | digital arrest | Elevated / Elevated | `authority_impersonation` did not fire on "Inspector Sharma from the Mumbai Cyber Crime cell" | BY DESIGN: "cyber crime cell" also appears in genuine advice to report there; `digital_arrest` and `urgency_deadline` already give the level |
| q02 | crypto group, 2 wallets | Elevated / Elevated | `fake_profit_proof` ("members withdrew 2.4 lakh") and `small_amount_first` ("start small with just 5,000") did not fire; `move_platform` counted | BY DESIGN: both phrasings are common in genuine text; `move_platform` was a hypothesis omission (it counts when another pattern is present) |
| q03 | sanctioned wallet | High / High | none | as expected: OFAC snapshot match |
| q04 | checksum lab | Low / Low | none | as expected: the case-flipped EVM, broken TRON and broken BTC were rejected; lowercase EVM is "format" |
| q05 | genuine bank advisory | Low / Low | none | as expected |
| q06 | genuine delivery OTP | Low / Low | none | as expected |
| q07 | friend asking for UPI, disclaimer | Low / Low | none | as expected |
| q08 | news article then a real scam | Elevated / Elevated | none | as expected: the news sentence is warning context, the request counts |
| q09 | spaced, emoji, Hinglish | Elevated / Elevated | none | as expected |
| q10 | task, KYC link, electricity, P2P freeze | Elevated / Elevated | `task_earn` did not fire on "Earn 3,000 a day just by liking videos" | BUG, fixed: a pattern for the reversed order with an amount per day; counter-cases "earn reward points by rating your orders" (no fire) and a police news sentence (warning context) added as eval cases p02-p03. The P2P "bank freeze" threat has no rule: known gap |
| q11 | remote access customer care | Elevated / Elevated | `fake_refund` did not fire on "refund ... install AnyDesk" | BY DESIGN: the refund rule needs a link, QR or PIN; `remote_access_app` covers this script |
| q12 | everything at once | High / High | `otp_pin_request` did not fire on "share your recovery phrase and your OTP"; `withdrawal_fee` and `move_platform` counted | BY DESIGN: the 15-character window keeps "share" next to "OTP"; "clearance fee" is in `withdrawal_fee` (hypothesis omission) |

After the fix `npm run eval` is 83 cases, precision 100.0%, recall 100.0%, FP 0, FN 0, and `scripts/redos-check.ts` reports no case at or over 200 ms (worst 4.9 ms).
