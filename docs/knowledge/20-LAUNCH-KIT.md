# Launch kit

## In plain words

Short, honest launch posts and a 30-second video script. They say what ScamLens is (evidence, not verdicts), what it is not (not legal advice, not a recovery service), its limits (few community reports at launch) and the real AI status (switched off). Links to the live site have a share preview image. Replace `<URL>` with the live link before posting.

## Details

### Share preview
`web/src/app/opengraph-image.tsx` renders a 1200x630 image: a black rule, the wordmark "ScamLens", the line "Evidence-linked scam check for India" and "Verified · Reported · Suspected, each with its source. Evidence, not verdicts." Metadata in `web/src/app/layout.tsx` sets Open Graph and a large Twitter card; set `NEXT_PUBLIC_SITE_URL` in Vercel if previews show a wrong host.

### Post drafts

**X (about 270 characters)**
> Got a message saying "digital arrest", "KYC expired" or "pay a fee to withdraw"? Paste it into ScamLens. It shows what is verified, what others reported and what is only suspected, each with its source. Evidence, not verdicts. Free, no sign-up. <URL>

**LinkedIn**
> We built ScamLens for Hacker House Goa 2026 (team ArcReap): a free check for suspicious messages in India.
>
> Paste a chat, wallet address, UPI ID or Telegram handle. ScamLens keeps three kinds of evidence apart: Verified (sanctions and blocklists, on-chain facts, each with a link), Reported (only after independent people reported the same identifier) and Suspected (<!-- FACT:rule_count -->18<!-- /FACT --> fixed language patterns, with the exact words quoted). It also says plainly what it could not check, gives an "I already paid" plan starting with 1930, and lets anyone verify a signed receipt of a result.
>
> What it is not: legal advice, a verdict about a person, or a way to recover money. Community reports are few at launch, so "no reports" never means safe. The text check uses fixed rules; an optional AI helper is built but switched off.
>
> Try it: <URL>
>
> Questions or corrections: <!-- FACT:contact_email -->scamlenspvt@gmail.com<!-- /FACT --> or <!-- FACT:x_handle -->@scamlens<!-- /FACT --> on X.

**WhatsApp (family group)**
> If a message asks you to pay a fee, share an OTP or "stay on the video call", you can paste it here first: <URL>. It shows warning signs and checks wallets and reports. It does not store your chat. If money has already gone, call 1930 right away.

Every post is published from <!-- FACT:x_handle -->@scamlens<!-- /FACT --> (<!-- FACT:x_url -->https://x.com/scamlens<!-- /FACT -->); the share card and favicon come from `docs/assets/` (exported by `web/scripts/export-brand-assets.ts`).

### 30-second video script
| Time | Picture | Voice |
|---|---|---|
| 0-5 s | The home page | "Got a message that feels wrong? Paste it into ScamLens." |
| 5-15 s | Sample 1 checked: the large word **High**, the 3-part meter, quoted phrases | "It shows the evidence: what is verified, what others reported, and what is only suspected, with the exact words." |
| 15-22 s | "What was checked" and "I already paid" | "It says what it could not check, and if you already paid, the first step is always 1930." |
| 22-30 s | "Share proof" on the result, then /verify showing "Signature valid" | "Evidence, not verdicts. Not legal advice. Free at <URL>." |

No receipt to hand for the last shot? On /verify press "Try an example" (it uses 1 daily check), then Verify. To show one pattern, open /patterns and press "Try this example".

### New since the final round
- "Common scams in India": five invented examples of commonly reported types, with the public pages they follow on /about#scam-types. Never claim a ranking.
- The scam trail and the community loop: say "links to other reported identifiers" and "counts only"; the live data is illustrative demo data until people contribute.

### Rules for every post
- No accusation words, no promise to prevent scams or recover money, no crypto product promotion.
- Say it shows evidence, not verdicts, and is not legal advice.
- Say reports are few at launch.
- AI: one line only, matching the real status: "The text check uses fixed rules; an optional AI helper is built but switched off."

## Where in the code

- `web/src/app/layout.tsx`: page metadata.
- `web/src/app/opengraph-image.tsx`: the share image.
- `web/src/app/icon.svg`: the icon.

## How to change it safely

Keep posts in line with the rules above and with [14-DEMO-AND-JUDGING.md](14-DEMO-AND-JUDGING.md); wrap any number from the code in a FACT marker so `npm run docs:check` verifies it.

## How it is tested

`npm run docs:check` (numbers in FACT markers, banned words in quotes) and `web/src/lib/launch.test.ts` (metadata and image colours).

## Known limits

The posts are drafts; nothing was posted by the automated run.
