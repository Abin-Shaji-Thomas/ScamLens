# UI checklist (Minimalism & Swiss Style)

Design reference (UI round, 2026-10-30): white `#ffffff` and paper `#f5f1e8` backgrounds; black `#000000` text, secondary text `#4b5563`, accent clay `#7a4f32`, alert `#b00020` only for the word "High" (and its meter) and the graph's evidence-path link; 1px dividers `#e5e7eb`; grey `#808080` only for graph links, empty meter segments and disabled borders; tan `#b38b6d` only for the card hover rule on white. Grey and tan never carry text. 12-column grid up to 110rem, one column below 768 px. No shadows, gradients, rounded corners or dark mode.

Automated coverage: `web/src/lib/style.test.ts` (palette, bans, motion), `web/src/lib/contrast.test.ts` (WCAG ratios from the CSS variables, where grey/tan/alert may appear), `web/src/lib/ui.test.ts` (server-rendered markup of every state that renders without clicks).

The **Verified** column records what the 2026-10-30 run checked in headless Microsoft Edge (DevTools protocol) against `npm run start`. Anything marked "person" still needs a human.

| # | Check | How | Verified |
|---|---|---|---|
| 1 | No horizontal scroll at 375, 768, 1280, 1440, 1920 px on `/`, samples 1-3, `/about`, `/nope` | DevTools device mode; drag sideways | yes: `scrollWidth <= innerWidth` everywhere |
| 2 | The page uses the width: content is ~90% of the window at 1280/1440/1920 (capped at 1760 px) | look at the margins on a wide screen | yes: grid box 100 / 100 / 91.7% |
| 3 | Header: "ScamLens" (bold) left; "Patterns", "Verify a receipt", "About" right (grey-blue; the current page black and underlined, aria-current); 44 px tap areas; at 375 px the links wrap onto a second row without overflow | look at 375 and 1440 px | render tests; browser check in H2 |
| 4 | Hero title is very large, regular weight (solid Arial, not a thin face) and spans about three quarters of the width | look | yes: `ArialMT` weight 400 on Windows (`CSS.getPlatformFontsForNode`, finish round 2026-10-30); other OSes: person |
| 5 | Form: label in small uppercase letters, text box with a 2px black line on top and a light line below, black "CHECK" and outline "UPLOAD A SCREENSHOT INSTEAD" buttons; right column with a black rule, "TRY A SAMPLE:", three sample links and the two privacy notes | look at >= 1024 px; below that they stack | yes |
| 6 | Risk header: "RISK CARD", the level as a huge word ("High" in dark red, others black), one sentence, the row "Low signals · Elevated · High" with the current level bold and underlined, and a 3-part meter (1, 2 or 3 filled) | samples 1, 2, 3 | yes: sample 1 High/3, sample 2 High/3, sample 3 Low signals/1 |
| 7 | Tiers: three columns at >= 1024 px, each with a 2px black top rule, small "01/02/03", heading, grey-blue explanation, rows divided by thin light lines | look | yes |
| 8 | Card hover: the top rule turns tan on white (clay on the paper band) | hover a tier | person (hover colour) |
| 9 | Quotes in Suspected are bold and underlined, never highlighted | sample 1 | yes |
| 10 | Notices are grey-blue paragraphs starting with "Note" | paste `Claim your bonus at zz-demo-bonus-claim.example.com today` | yes (render test) |
| 11 | "Illustrative demo data - not a real investigation" small grey-blue on samples, seeded reports and the seeded graph | samples | yes |
| 12 | "What to do now" is a full-width beige band: heading left, numbered steps right with large regular numerals | any result | yes |
| 13 | Graph (sample 1, "Show links for upi ..."): checked identifier filled black, others hollow with a black outline, links thin grey, links named in a listed path thicker dark red, black labels below each circle on a white halo; the whole graph fits inside the canvas, centred | look at 375, 768 and 1440 px | yes (2026-10-30, TigerGraph finish round: 26-58 px margins at all three widths, after resize and fresh; `docs/screens/graph-fit-*.png`) |
| 14 | "The graph database is waking up..." appears as plain text after about 3 s when TigerGraph is cold | live site with a suspended workspace | person (TigerGraph was not cold locally) |
| 15 | Report form: "Report these identifiers" expands in place; underline select, visible labels, 44 px checkbox rows, "SUBMIT REPORT" button; Cancel collapses it. Do not submit test reports on the live site. | a non-sample check with a UPI ID | yes (opened, not submitted) |
| 16 | Contest: "Contest this entry" expands an underline field inline; "Contested, under review" is bold clay text | needs a Reported entry for your own identifier | person (label checked by render test) |
| 17 | Loading ("CHECKING...", the grey-blue waiting line), error ("Error. ..." in black, no stack trace): DevTools > Network > Offline, press Check | person | person |
| 18 | Screenshot flow (needs a vision key): transcript editor uses the ruled text box and a "CHECK THIS TEXT" button | person | person |
| 19 | `/about`: small "BACK TO THE CHECK", huge light title, sections with the heading left and text right, alternating white and beige bands, data sources as rows with thin lines | look | yes |
| 20 | `/nope`: oversized "404", "Page not found", "Go to the check" link | look | yes |
| 21 | Footer: 2px black rule, "About", "Not legal advice", the 1930 line | look | yes |
| 22 | Keyboard: Tab order ScamLens -> About -> text box -> (Check when enabled) -> Upload a screenshot -> samples 1-3 -> footer About; after a check focus lands on "Risk card", then Contest (if shown) -> graph -> Copy / Preview / Print -> Report -> footer | Tab key | yes: every stop shows `2px solid rgb(0, 0, 0)` with a 3px offset |
| 23 | Tap targets at 375 px are at least 44 px (including links inside sentences) | DevTools | yes: smallest 44 px |
| 24 | Body text at 375 px is 18 px, small text never below 14 px | DevTools | yes |
| 25 | Reduced motion: no transitions | OS "Animation effects" off, or DevTools Rendering > prefers-reduced-motion | yes: all transition durations `0s`; graph code unchanged (layout settled, no drag) |
| 26 | Print preview of a result: black on white only, no beige band, meter in black, title and risk word at normal size, form/header/footer hidden | "Print or save as PDF" | yes (print media emulated: only `rgb(0, 0, 0)` text, band white, risk word 32px black) |
| 27 | Zoom 200% at 1280 px: no lost content, no sideways scroll | Ctrl + = | yes: 640 px viewport, no overflow, same text length (2630 chars) |
| 28 | Console: no errors and no Content Security Policy violations on `/`, after a check, after "Show links", `/about` | DevTools Console | yes: no messages. `/nope` logs only the expected "404 (Not Found)" for the page itself |
| 29 | Screen reader: "Result ready: <level>." announced; scale read as "Scale: <label>"; tier numerals 01-03 and the 404 numeral are not read | NVDA / VoiceOver | person |
| 30 | The same checks on the live URL after deploy | browser | yes: release gate and live runs in `docs/PROGRESS.md` (final round J8; TigerGraph finish round G7) |
| 31 | Coverage ledger "What was checked": every source with a status word and a date, "Not checked" lines, never "clean"; "Link graph" row says "not looked up (press Show links)" until Show links, then "checked" with the backend and ms | any result | yes (final round J6; Link graph row live 2026-10-30: "not looked up (press Show links)" -> "checked · tigergraph, 654 ms") |
| 32 | "I already paid": 7 steps starting with 1930, 4 optional fields, COPY COMPLAINT DRAFT; nothing sent | open it on a result | yes (0 requests measured); clipboard: person |
| 33 | "Share proof" step under the evidence pack: the sentence, "Download signed receipt", "Open Verify" and "Receipt code ..." (absent with no receipt); /verify says "Signature valid ..." for it and "Signature not valid ..." for an edited copy | download, paste at /verify | yes (final round J6 and J8) |
| 34 | /patterns: 18 rules, each with what it looks like, why, what to do, an illustrative example, when it is not a signal, how it counts; each Suspected finding links to its anchor | open /patterns | yes (final round J6) |
| 35 | Share preview: pasting the link in a chat app shows the 1200x630 image with the wordmark | paste the live link | image and tags verified locally; real chat apps: person |
| 36 | Graph note reads "Graph backend: tigergraph (N ms)" (fallback: "postgres (TigerGraph unavailable)") | sample 1 -> Show links | yes, live 2026-10-30: "Graph backend: tigergraph (654 ms)" at 1440, 614 ms at 375; graph fits (`docs/screens/live-graph-*.png`) |
| 37 | Linked-identifier hint under Reported: "This UPI ID is linked to N other identifiers in community reports. Show links to see how." with "A link is not proof of wrongdoing." and the demo label (absent when there are no links or on failure) | sample 1 | yes, live 2026-10-30: "This UPI ID is linked to 4 other identifiers in community reports. Show links to see how." with the note and demo label (`docs/screens/live-hint-1440.png`) |
| 38 | /about "Link graph" section ends with "Right now the graph holds N vertices ... and M links, counted by TigerGraph." (omitted on failure) | open /about | yes, live 2026-10-30: "Right now the graph holds 22 vertices (identifiers and reports) and 21 links, counted by TigerGraph." (`docs/screens/live-about-graph-1440.png`) |
| 39 | Home: a "Beyond the check" band with Patterns (with the live rule count), Verify a receipt and About, each with one sentence and a link; three columns on desktop, one on phones; under the form before a check, after the result once there is one; hidden in print | open / | render tests; browser check in H2 |
| 40 | "What was checked": a "Why?" link to /about#sources after each "not applicable" status and under the Not checked list | sample 3 | render tests; browser check in H2 |
| 41 | /patterns: "Check a message" under the intro; "Try this example" under each example opens / with that example in the box, labelled "Example from the pattern library: ...", not yet checked; `/?example=nope` gives an empty box | open /patterns, press a link | render tests; browser check in H2 |

Font note: the stack is `Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif` (finish round, 2026-10-30): Arial first so every OS draws the same solid letterforms; Linux and Android fall back to metric-compatible faces. Headings are weight 400 and bold labels 600; there is no light weight. Measured in headless Edge on Windows at 375-1920 px: every heading, text style and button renders `ArialMT` (bold labels `Arial-BoldMT`), identical to the owner's earlier localhost look (0 differences across 75 values).
