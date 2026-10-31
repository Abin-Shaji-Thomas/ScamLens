# Signal rules

## In plain words

The Suspected tier comes from <!-- FACT:rule_count -->19<!-- /FACT --> fixed rules. Each rule is a short list of text patterns for one scam tactic, for example "pay a fee to withdraw" or "stay on the video call". When a pattern matches, ScamLens shows the rule and the exact words it matched. A hit inside a sentence that warns about scams ("never share your OTP") is shown separately and does not count. The optional AI helper may only point at these same rules, and it is switched off in this deployment.

## Details

All rules (generated from `web/src/lib/signals/rules.ts`):

<!-- GENERATED:START rules -->
| # | id | label | patterns | guards |
|---|---|---|---|---|
| 1 | `guaranteed_returns` | Guaranteed or fixed daily returns | 7 | drops a negator right before |
| 2 | `withdrawal_fee` | Pay a fee or tax to unlock or withdraw funds | 4 | none |
| 3 | `urgency_deadline` | Urgency, deadline or threat of blocking | 6 | none |
| 4 | `seed_phrase_request` | Asks for seed phrase or private key | 3 | drops negated hits |
| 5 | `otp_pin_request` | Asks for OTP, UPI PIN or CVV | 2 | drops negated hits; ignores a code right after |
| 6 | `move_platform` | Moves the conversation to Telegram or WhatsApp | 3 | needs a second rule |
| 7 | `remote_access_app` | Asks to install a remote-access or unknown app | 3 | drops negated hits |
| 8 | `authority_impersonation` | Claims to be police, CBI, customs or another authority | 3 | none |
| 9 | `digital_arrest` | "Digital arrest" or arrest-warrant threat | 6 | rule-specific negation |
| 10 | `fake_kyc` | KYC / PAN / Aadhaar update threat | 2 | drops negated hits |
| 11 | `fake_refund` | Refund or cashback that needs your PIN, a QR scan or a link | 2 | drops negated hits |
| 12 | `task_earn` | Like-and-earn or paid online tasks | 5 | none |
| 13 | `romance_investment` | Romantic contact steering towards investment | 1 | none |
| 14 | `third_party_account` | Pay into a third party's account | 3 | none |
| 15 | `small_amount_first` | "Send a small amount first" | 2 | none |
| 16 | `fake_profit_proof` | Screenshots or claims of others' profits | 2 | none |
| 17 | `prize_lottery` | Prize, lottery or lucky draw win | 3 | none |
| 18 | `utility_disconnection` | Electricity or utility disconnection threat | 1 | none |
| 19 | `account_hacked_deposit` | "Account hacked" or freeze threat with a security deposit or secrecy | 3 | needs a second rule |
<!-- GENERATED:END rules -->

How a rule runs (`web/src/lib/signals/regex.ts`):
1. **De-obfuscation.** Patterns run on a cleaned copy of the text: zero-width characters removed, emoji used as separators turned into spaces, spaced-out letters joined ("O T P", "K.Y.C"). Every match is mapped back, so the quote is always cut from the original text.
2. **Guards** (the "guards" column above):
   - *drops negated hits*: a negation earlier in the same sentence ("never share your OTP") cancels the hit.
   - *drops a negator right before*: only a negator directly before the match ("does not guarantee returns").
   - *rule-specific negation*: the digital-arrest rule ignores advice such as "there is no such thing as a digital arrest".
   - *ignores a code right after*: "Share OTP 4821 with the delivery agent" is the code's issuer, not a request.
   - *needs a second rule*: moving to Telegram or WhatsApp counts only when another rule also fired.
3. **Warning context** (`web/src/lib/signals/context.ts`): hits in a sentence with a protective marker (beware, red flag, advisory, "never/do not" + advice, "police said", news:, Hinglish savdhan/satark...) or continuing such a sentence are marked `context: "warning"`: shown under "Mentioned in a warning or news-style text" and not counted.
   - **Solicitation beats a marker** (final round): if the hit's sentence also asks the reader to act (send, pay, transfer, deposit, invest, join, click, download, "share your", "contact/DM/text/WhatsApp me", Hinglish bhejo / pay karo / join karo...), the hit is never warning context. "Asks the reader" means the verb opens a clause (an imperative, optionally after please, just, now, and, then) or follows "you must/should/need to"; a negator earlier in the same clause cancels it ("Never send money to strangers"). So "Beware of fake sites, send 5000 USDT now to join our group, guaranteed profit" is flagged, while "News: police said such messages ask people to pay a withdrawal fee" stays a warning.
   - **Conditional awareness** (final round): "If someone says your account will be blocked unless you pay, it is a fraud call" (and the Hinglish "agar koi ... to ye fraud hai") is a warning marker, because the sentence itself calls the situation a fraud. A threat with a condition ("If you do not pay the clearance fee within 2 hours, police will arrest you") is not: it never names a fraud, and the "do not + advice" marker no longer fires after "if/unless you".
4. **Optional AI pass** (`web/src/lib/signals/llm.ts`): the model may only return `{rule_id, quote}`; `web/src/lib/signals/validate.ts` drops any unknown rule id or any quote that is not an exact substring of the input. With no key the status is `off`: the card says "Suspected signals come from fixed pattern rules only." and it is not counted as an unavailable source. A configured pass that fails or is skipped is `unavailable` and is counted.

Each counted rule adds one "suspected pattern" to the risk engine, however many times it matches. Suspected patterns alone can reach Elevated, never High.

Public explanations of every rule: the pattern library at `/patterns` (see [19-DISTINCTIVE-FEATURES.md](19-DISTINCTIVE-FEATURES.md)). When a rule is added, add its entry to `web/src/lib/signals/pattern-guide.ts`; a test fails otherwise.

## Where in the code

- `web/src/lib/signals/rules.ts`: the rule list.
- `web/src/lib/signals/regex.ts`: matching, de-obfuscation and guards.
- `web/src/lib/signals/context.ts`: warning context.
- `web/src/lib/signals/validate.ts`: AI output validation.
- `web/src/lib/signals/index.ts`: combines the passes.

## How to change it safely

Add a pattern only with a test that it fires on a scam example and a test that it does not fire on a similar normal message. Run `npm run eval` and compare false positives and false negatives before and after; never tune a pattern to a single eval case. Run `npx tsx scripts/redos-check.ts` after any regex change (worst case must stay well under 200 ms).

## How it is tested

`web/src/lib/signals/signals.test.ts` (each rule, guards, de-obfuscation, hallucinated AI quotes dropped), `web/src/lib/signals/context.test.ts` (warning context and decoys), the eval in `eval/run.ts`, and the ReDoS script.

## Known limits

- `account_hacked_deposit` (demo-video round) needs a second pattern: it fires on an assertive "your account has been hacked/compromised", a "security/verification deposit or fee", or "do not tell anyone or visit the branch", but a rental security deposit alone or advice such as "if your card was compromised, call the bank" never counts. A genuine advisory ("your account may be at risk, do not share your OTP, visit the branch") stays Low (eval d02, tests). `urgency_deadline` also matches a threat verb right before a countdown ("FROZEN in 30 minutes"), not "delivered in 30 minutes".
- Narrow on purpose (final round P2, `eval/qa-scenarios.md`): "Inspector X from the Mumbai Cyber Crime cell" does not fire `authority_impersonation` ("cyber crime cell" also appears in genuine advice to report there); "members withdrew 2.4 lakh" does not fire `fake_profit_proof`; "start small with just 5,000" does not fire `small_amount_first`; a refund plus "install AnyDesk" counts only as `remote_access_app`; "share your recovery phrase and your OTP" is past the 15-character window of `otp_pin_request`. Each would add false positives on genuine text; in every case other patterns still give the same level.
- `task_earn` matches the reversed order "earn 3,000 a day by liking videos" only with an amount and a per-day word (final round P2), so "earn reward points by rating your orders" does not fire.

Rules are English-first; the Hinglish set is small. A warning sentence and a scam request in the same sentence is a known gaming route (addressed in this round, see [07-RISK-ENGINE.md](07-RISK-ENGINE.md)).
