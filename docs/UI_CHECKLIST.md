# UI checklist (manual, needs a real browser)

The automated runs could not open a browser. Server-side render tests cover the markup of every state that does not need clicks (`web/src/lib/ui.test.ts`), and `web/src/lib/style.test.ts` enforces the palette. Layout, focus, print, zoom, motion and screen readers need a person. Use the live URL (and once `npm run start` locally). Chrome DevTools device mode at **375 x 667** unless stated.

Design reference (round 2): white `#ffffff`, ink `#111111`, secondary text `#767676`, hairlines `#eeeeee`; system sans-serif; no boxes, shadows, rounded corners, colours or dark mode.

## 1. Layout at 375 px
- [ ] `/`: no horizontal scroll (drag sideways; nothing moves). Side padding is at least 24 px on both sides.
- [ ] Header: "ScamLens" (bold) on the left, "About" (gray) on the right.
- [ ] Title wraps cleanly at 32 px; intro text in gray under it.
- [ ] The text box is borderless with one black underline; placeholder is gray. "Check" is a black square button; "Upload a screenshot instead" is an underlined text link beside or under it.
- [ ] Sample 2: the 42-character wallet under "Identifiers found" wraps inside the column, in the same sans font.
- [ ] Verified rows: bold title ("Match · OFAC SDN list"), gray detail, gray "source · date · source" line with the link underlined. Long values wrap.
- [ ] `/about` and a 404 page (e.g. `/nope`): same column, same type, no sideways scroll.
- [ ] Footer: a hairline, then "About", "Not legal advice" and the 1930 line in gray.

## 2. Visual rules (spot check on desktop and 375 px)
- [ ] No coloured text, backgrounds, borders, shadows or rounded corners anywhere, in any state (empty, result, graph, report form, contest form, evidence pack preview, notices, errors).
- [ ] Sections are separated by large empty space; hairlines appear only between the three tiers and above the evidence pack/footer.
- [ ] Risk header: a large bold word (Low signals / Elevated / High), one plain sentence, and the line "Low signals · Elevated · High" with the current level bold and black, the others gray.
- [ ] Tier headings read "01 Verified", "02 Reported", "03 Suspected", each with a one-line gray explanation.
- [ ] Quoted phrases in Suspected are bold and underlined (no yellow highlight).
- [ ] "Illustrative demo data - not a real investigation" appears as small gray text on samples, seeded reports and the seeded graph.
- [ ] Notices appear as gray paragraphs starting with "Note:" (paste `Claim your bonus at zz-demo-bonus-claim.example.com today`).

## 3. States
- [ ] Empty: "Risk card" (small gray) and "Paste something and press Check"; each tier shows its empty sentence.
- [ ] Loading: the button reads "Checking..." and the gray line "Checking lists, on-chain history and reports..." appears.
- [ ] Error: DevTools > Network > Offline, press Check. "Error. ..." appears in black text (no red), with no stack trace and no echo of your text.
- [ ] Graph: on sample 2 press "Show links for evm ...". The card is fully shown before (the graph never blocks it). If TigerGraph is cold, the gray line "The graph database is waking up..." appears after about 3 s.
- [ ] Graph drawing (sample 1, "Show links for upi ..."): the checked identifier is a filled black circle, others are white circles with a thin black outline, links are thin gray lines, labels are black under the circles. The text list of paths appears under the graph.
- [ ] Warning context: paste `I read that guaranteed returns are a red flag, so I only do a monthly SIP.` Result is "Low signals"; Suspected shows a collapsed line "Mentioned in a warning or news-style text (1)" that opens on click.
- [ ] Report form: "Report these identifiers" is a text link; clicking it expands the form in place (no pop-up); "Cancel" collapses it.
- [ ] Contest (needs a Reported entry for your own identifier): "Contest this entry" expands an underline field inline; after sending, the message says the entry is labelled "Contested, under review".
- [ ] Screenshot flow (needs a vision key; without one the gray/black "Error. Screenshot reading is not available right now..." message appears): the transcript editor uses the same underline field, with a "Check this text" button.

## 4. Keyboard only (unplug the mouse)
- [ ] Tab order: ScamLens -> About -> text box -> Check -> Upload a screenshot instead -> sample links -> (after a check) graph links -> Preview / Print / Copy -> Report these identifiers -> footer About.
- [ ] Every focused control shows a 2 px black outline with a small gap (the text box instead shows a 2 px underline).
- [ ] After a check, focus moves to "Risk card" (it gets the outline).
- [ ] Enter on "Upload a screenshot instead" opens the file picker.
- [ ] Space/Enter opens and closes the "Mentioned in a warning..." group.

## 5. Screen reader (NVDA on Windows or VoiceOver on macOS/iOS)
- [ ] After a check, "Result ready: <level label>." is announced.
- [ ] Errors are announced (role=alert).
- [ ] The risk scale is read as "Scale: <label>"; the graph is announced as an image whose links are listed as text below.
- [ ] Every input has a spoken label (text box, file picker, transcript, report checkboxes, scam type, consent, contest reason).

## 6. Zoom to 200%
- [ ] Ctrl + = to 200% on a 1280 px wide window: single column, no overlapping text, no horizontal scroll, buttons still reachable.

## 7. Print preview
- [ ] Run sample 2, click "Print or save as PDF". The preview shows black text on white only: the risk header, tiers and the evidence pack text. The form, samples, screenshot link, graph canvas, report form, header and footer are hidden. Tiers do not split across pages where avoidable.
- [ ] For a sample, the pack starts with "*** Illustrative demo data - not a real investigation ***".

## 8. Motion
- [ ] With the OS setting "reduce motion" on (Windows: Settings > Accessibility > Visual effects > Animation effects off), the graph appears already laid out, without the floating animation.

## 9. Security policy
- [ ] Open DevTools Console and confirm there are no Content Security Policy errors (on `/`, after a check, after "Show links", and on `/about`).
