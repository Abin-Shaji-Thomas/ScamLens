# Indian synthetic dataset

**Illustrative demo data.** `eval/india-cases.json` holds 56 synthetic cases in 10 campaigns. Each campaign is modelled on a scam type that public advisories or news reports describe in India. Nothing in it is a real case: every UPI ID is a `zzdemo.*@okdemo` demo handle, every Telegram handle starts with `@zzdemo_`, every domain is under `example.com`, `example.net` or `example.org`, every wallet is the address of a freshly generated random key that was discarded (`eval/synthetic-wallets.json`, from `web/scripts/gen-synthetic-wallets.ts`), and every reporter is a documentation IP address (198.51.100.0/24) turned into a fingerprint through the same HMAC path real reports use. No real person's name, number, UPI ID, handle or wallet appears. Every row is written with `synthetic = true`, and the site labels it "Illustrative demo data".

The dataset makes no claim about how common any scam type is. The campaign sizes were chosen to exercise the graph (small and large campaigns, shared identifiers), not to reflect a ranking.

## Campaigns and the public pattern each one models

The sources below were opened on 2026-10-30. Each line paraphrases the page; nothing is copied, and no figures are taken from them.

| # | Campaign | Cases | What the cases contain | Public source (opened 2026-10-30) |
|---|---|---|---|---|
| 1 | Digital arrest (fake CBI or police) | 9 | a caller claims to be an investigating officer, says a parcel with drugs was seized, keeps the person on a video call and demands a "verification" transfer; two demo UPI IDs, one demo handle | The Tribune (PTI), 7 Oct 2024: report of an I4C advisory saying real agencies do not arrest anyone over video calls, and to report such calls to 1930 or cybercrime.gov.in. https://www.tribuneindia.com/news/india/cbi-ed-dont-nab-via-video-calls-advisory-to-curb-digital-arrest/ |
| 2 | Telegram like-and-earn tasks | 10 | paid "like" tasks, a joining fee, a VIP task group; one admin handle (shared with campaign 9), a collection wallet named with four different handles by four reporters, a wallet shared with campaign 3, and an exchange-style address | CareerIndia, 17 Sep 2026: article on task scams over Telegram and WhatsApp that pay small sums first and then ask for larger deposits; advice to refuse any fee and call 1930. https://www.careerindia.com/features/telegram-and-whatsapp-task-scams-how-to-identify-fake-work-from-home-job-offers-and-protect-your-money-2026-011-65711.html |
| 3 | Romance, then a crypto investment group | 8 | a contact met on an app moves the person to a "trading mentor" group and a fake exchange domain; UPI ID to wallet to Telegram links split across different reporters; on-chain payments to a flagged demo address within 1 and 2 hops | The News Minute, 5 May 2022: report of a "pig butchering" case where trust built on social media led to a fake crypto exchange that blocked withdrawals. https://www.thenewsminute.com/article/chennai-man-loses-rs-10-lakh-pig-butchering-fake-crypto-scam-163617 |
| 4 | Fake KYC / bank block | 5 | an SMS says the account will be blocked unless KYC is updated through a link and an OTP is shared; one demo domain, one demo UPI ID | Reserve Bank of India press release, 13 Sep 2021: caution against calls, SMS or emails asking for a KYC update through links or apps, with threats of a frozen account; advice to contact the bank directly. https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=52216 |
| 5 | Electricity disconnection | 3 | a message threatens disconnection tonight and asks the person to call an "officer" and pay | Kotak Mahindra Bank, "The Electricity SMS Fraud" (no date shown): texts threatening a power cut lead to calls that ask for bank details or a remote-access app; advice to use the utility's official numbers. https://www.kotak.bank.in/en/safe-banking/safe-banking-articles/the-electricity-sms-fraud.html |
| 6 | Lottery or prize | 5 | a prize "won" in a lucky draw needs a processing fee; includes a small shop's own UPI ID named by mistake, later contested | Reserve Bank of India press release, 6 Feb 2012: caution against lottery and prize offers with forged letterheads that ask for growing fees; RBI does not send such notices. https://www.rbi.org.in/commonman/english/Scripts/PressReleases.aspx?Id=2440 |
| 7 | P2P USDT "bank freeze" buyer | 5 | after a peer-to-peer USDT sale the "buyer" claims a frozen account and demands the money back; a TRON address, a wallet named with two handles by two reporters, and the exchange-style address | Siasat, 3 May 2024: report of a Hyderabad police advisory that P2P crypto traders can unknowingly receive fraud money and have their bank accounts frozen. https://www.siasat.com/hyderabad-police-advisory-warns-against-p2p-crypto-trading-frauds-3019426/ |
| 8 | Loan-app harassment | 3 | an "overdue" instant loan with threats to message the person's contacts; one demo UPI ID and domain | The News Minute, 23 Dec 2020: report of an RBI caution against unauthorised digital lending apps with hidden charges and abusive recovery; verify the lender first. https://www.thenewsminute.com/article/rbi-cautions-individuals-small-businesses-against-unauthorised-digital-lending-apps-140183 |
| 9 | Fake work-from-home job | 5 | a typing job with a registration fee, run by the same admin handle as campaign 2; includes a tutor's own UPI ID named by mistake, later contested | CareerIndia, 17 Sep 2026 (same article as campaign 2): fake work-from-home offers that ask for fees before any pay. https://www.careerindia.com/features/telegram-and-whatsapp-task-scams-how-to-identify-fake-work-from-home-job-offers-and-protect-your-money-2026-011-65711.html |
| 10 | Remote-access "customer care" | 3 | a refund "agent" asks the person to install AnyDesk and read out the code; one demo UPI ID and domain | Kotak Mahindra Bank (same page as campaign 5), which describes callers getting people to install remote-access apps; Reserve Bank of India press release, 7 Mar 2022, announcing the BE(A)WARE booklet on how financial frauds work. https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=53372 |

Pages that could not be opened by the tools used here (Press Information Bureau pages returned 403, and the BE(A)WARE PDF could not be read as text) are not cited.

## Demo-video campaign (`eval/demo-video.json`)

For a filmed demo, the SMS in `docs/demo/video-sms.txt` ("Your bank account has been HACKED ... pay a security deposit of Rs 35,000 ... Do not tell anyone or visit the branch") is reported by 4 synthetic networks (documentation addresses 203.0.113.101-104, through the real HMAC path). Each of the 4 cases names the UPI ID `secure.helpdesk35@okdemo` and the wallet `0x928c3dC199f45304d8145aed7a6Db53e6b158304` together, with category "account hacked / security deposit" (`account_hacked`), channel SMS, loss band Rs 10,000 to 1 lakh, month 2026-10, `synthetic = true`. So each identifier has 4 independent reporters and the two are linked for the scam trail. The SMS also counts 2 patterns (`account_hacked_deposit`, `urgency_deadline`), so the level is High through the allowed path: reports plus a counted pattern. It is seeded and removed with the commands below, together with the 56-case dataset; it models the bank-account-hacked pattern in the RBI KYC caution above (threats to freeze an account to make people pay or share details). Remove it after filming: `npx tsx scripts/seed-india-cases.ts --remove`.

## What the graph gets

- **Q1** (UPI ID to wallet to Telegram, halves from different reporters): campaigns 2 and 3; non-empty for 4 cases on the live graph.
- **Q2** (payments to a flagged address within 2 hops): campaign 3's wallets reach the flagged demo address in 1 and 2 hops; a path that runs only through the exchange-style address is ignored.
- **Q3** (Telegram handles reported with the same wallet by different reporters): campaign 2's collection wallet (4 handles) and campaign 7's buyer wallet (2 handles).
- **Hub filter**: the exchange-style address (`add_exchange`) is excluded from every path.
- **Contested**: the shop's and the tutor's UPI IDs are reported by 2 networks and then contested, so they show "Contested, under review" and never count toward High.
- **Cases** (after migration 004): one `cases` row per case with category, channel, loss band and month, and no excerpt.

## Running it

```
cd web
npx tsx scripts/seed-india-cases.ts            # dry run: counts only
npx tsx scripts/seed-india-cases.ts --local    # in-memory Postgres, prints the query counts
npx tsx scripts/seed-india-cases.ts --apply    # write to the Supabase project in web/.env.local (idempotent)
npx tsx scripts/tg-setup.ts --load             # copy to TigerGraph and check parity
npx tsx scripts/seed-india-cases.ts --remove   # delete only this dataset's rows
```

Re-running `--apply` rewrites the same rows: submission ids, delete codes and fingerprints are derived from the case ids, and contests are added only once. `--remove` deletes only rows with `synthetic = true` and this dataset's submission ids or hashes, plus the contests whose reason starts with "Synthetic dataset:". TigerGraph keeps its copies until they are removed by hand (`docs/MODERATION.md` section 4).

## Result on 2026-10-30

`--apply` on the live project: 56 cases, 104 reports, 36 identifiers, 5 payments, 1 flagged and 1 exchange-style address, 2 contested; 0 case rows because migration 004 had not been run (a HUMAN STEP: run it, then `--apply` again). `tg-setup.ts --load`: 104 vertices and 119 edges loaded; `parity TigerGraph vs Postgres: 63/63 queries SAME`; dataset checks PASS (Q1 4 cases, Q2 8 cases, Q3 3 clusters, 0 paths through the 2 exchange-style addresses).
