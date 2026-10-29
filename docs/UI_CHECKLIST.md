# UI checklist (manual, needs a browser)

The automated run could not open a browser. The risk card is render-tested on the server (`src/lib/ui.test.ts`), but layout, focus, print and canvas behaviour need a human. Tick each item on the live URL (and once on `npm run start` locally). Use Chrome DevTools device mode at **375 x 667** (iPhone SE) unless stated.

## 1. Layout at 375 px
- [ ] `/`: no horizontal scroll anywhere (drag the page sideways; nothing moves).
- [ ] Sample buttons wrap onto several lines; the Check button stays visible next to the privacy line, or wraps below it.
- [ ] After sample 2 ("Crypto investment with a sanctioned wallet"), the 42-character wallet chip under "Identifiers found" wraps inside the card instead of overflowing.
- [ ] Verified rows: badge, source name, summary, facts and "source" link fit; long values wrap.
- [ ] `/about`: headings and lists readable, links tappable, no sideways scroll.
- [ ] The footer link "About, sources and privacy" appears on both pages.

## 2. The three tiers
- [ ] Each tier reads "Tier 1 of 3 Verified", "Tier 2 of 3 Reported", "Tier 3 of 3 Suspected" and has its own coloured left border. With colours ignored (DevTools > Rendering > Emulate vision deficiency > Achromatopsia), the tiers are still told apart by their titles.
- [ ] The risk header shows a symbol (▲ / ! / ○), the label, and one plain-language sentence under it.
- [ ] Suspected quotes are highlighted (yellow `<mark>`), each with its rule id.
- [ ] Sample 1: the Reported tier shows "No known reports. This does not mean safe." when the database works, or a "Reports database unavailable ... not a clean result" line when it does not. It must never be empty.
- [ ] "What to do now" lists 5 steps, including 1930, cybercrime.gov.in and "contact your bank or UPI app immediately".

## 3. States
- [ ] Loading: while checking, the button says "Checking..." and the line "Checking lists, on-chain history and reports..." appears.
- [ ] Error: with DevTools > Network > Offline, press Check. A red message appears (no stack trace, no echo of your text).
- [ ] Rate limit (optional): with `USAGE_CHECK_PER_DAY=2` locally, the 3rd check shows "You have reached today's limit...".
- [ ] Empty: on first load the card says "Paste something and press Check" and each tier shows its empty text.
- [ ] Notices: paste `Claim your bonus at zz-demo-bonus-claim.example.com today`. The card shows a "Note:" line saying domains are not checked against a blocklist.
- [ ] Graph: on sample 2 press "Show links for evm ...". The card is already fully visible before you press it (the graph never blocks it). If TigerGraph is cold, "The graph database is waking up..." appears after about 3 s.
- [ ] Graph on seeded demo data (UPI `zzdemo.refund@okdemo`): "Illustrative demo data - not a real investigation" appears above the graph. The canvas fits the card width at 375 px.

## 4. Screenshot input
- [ ] "Or read the text from a screenshot" accepts PNG/JPEG/WebP only (try an SVG: refused with a message).
- [ ] Without an AI key (current live setup): picking an image shows "Screenshot reading is not available right now. Please paste the text of the chat instead."
- [ ] With a vision key (HUMAN_TASKS 4): the transcript appears in an editable box labelled "Text read from your screenshot. Edit if needed, then check."; edit it, press "Check this text", and the card uses the edited text.

## 5. Keyboard and screen reader
- [ ] Tab order: sample buttons -> textarea -> Check -> file picker -> (transcript box -> Check this text) -> card controls (graph buttons, evidence pack, report form) -> footer link.
- [ ] After a check, focus jumps to the "Risk card" heading (a focus ring or screen-reader announcement).
- [ ] With NVDA or VoiceOver: "Result ready: <label>." is announced after a check; errors are announced (role=alert).
- [ ] Every input has a visible label (textarea, file picker, transcript, report checkboxes, contest reason).

## 6. Print / evidence pack
- [ ] "Print or save as PDF" opens the print dialog with the evidence pack expanded. The preview hides the form, the screenshot picker, the report form and the buttons; tiers do not split across pages where avoidable; white background.
- [ ] For a sample, the printed pack starts with "*** Illustrative demo data - not a real investigation ***".
- [ ] "Copy evidence pack" copies text (or shows it if the clipboard is blocked).

## 7. Dark mode
- [ ] OS dark mode: text is readable in every tier, in notices (amber box) and in the demo label.
