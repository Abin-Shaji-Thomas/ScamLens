# UI design system

## In plain words

The interface follows Minimalism & Swiss Style: a 12-column grid that fills the window up to 1760 px, large regular-weight headings, lots of white space, 2 px black rules instead of boxes, and ten fixed colours. Colour never carries meaning on its own: the risk level is a word, a bold underlined position and a meter. Grey and tan never colour text, because they are too faint to read.

## Details

### Tokens (CSS variables in `web/src/app/globals.css`)
| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--swiss-black` | #000000 | text, rules, buttons | 21.00 on white, 18.63 on paper |
| `--swiss-white` | #ffffff | background, button labels | 21.00 on black |
| `--swiss-paper` | #f5f1e8 | alternate bands ("What to do now", /about) | – |
| `--swiss-text` | #4b5563 | secondary text | 7.56 on white, 6.70 on paper |
| `--swiss-rule` | #e5e7eb | 1px dividers (decorative) | 1.24 (not used for meaning) |
| `--swiss-grey` | #808080 | graph links, empty meter segments, disabled borders; never text | 3.95 on white |
| `--swiss-tan` | #b38b6d | card hover rule on white only; never text, never on paper | 3.07 on white, 2.73 on paper |
| `--swiss-clay` | #7a4f32 | link hover, "Contested, under review", hover rule on paper | 7.02 on white, 6.23 on paper |
| `--swiss-alert` | #b00020 | only the word "High", its meter, and evidence-path graph links | 7.33 on white |
| `--swiss-black-hover` | #1f2937 | button hover | white on it 14.68 |

### Type
- Font stack: `Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif` (system fonts only; no web fonts). Arial comes first so Windows, macOS and iOS draw the same solid letterforms; Linux and Android use metric-compatible fallbacks. `font-synthesis: none` on the body: no faked weights. Measured 2026-10-30 (finish round): every element renders `ArialMT` / `Arial-BoldMT`.
- h1 `.t-title`: weight 400, `clamp(2.5rem, 6vw, 6rem)` / 1.05. Risk word `.t-risk`: `clamp(3rem, 8vw, 8rem)`. 404 numeral `.t-404`: `clamp(6rem, 20vw, 16rem)`.
- Section headings `.t-h2`: 1.5rem, weight 400. Two weights only: 400 for all text and headings, 600 for small bold labels, finding titles, the brand and buttons' labels where set; no light weight. Body 1.125rem / 1.6. Small `.t-small`: 0.875rem / 1.5, never below 14 px. `.eyebrow`: 0.875rem, 0.1em tracking, uppercase by CSS only.
- Reading text is capped at 65ch.

### Grid
`.grid`: 12 columns, gap `clamp(1rem, 2vw, 2rem)`, max 110rem, padding `clamp(3rem, 6vw, 6rem) clamp(1.25rem, 4vw, 3rem)`; one column below 768 px. Every top-level part of a page is a full-width `<section>` holding one `.grid`, so a `.band` background is full-bleed.

### Components
`.card` (2px black top rule, hover tan on white, clay on a band), `.button` (black, square, 44 px minimum, uppercase by CSS), `.button--outline`, `.btn-link` (underlined, 44 px tap height), `.textarea` (2px black top rule, 1px light rule below), `.field` (1px black underline), `.meter` / `.meter__seg`, `.steps` (large regular numerals), `.tap` (44 px tap area for links inside sentences). Focus: `outline: 2px solid var(--swiss-black); outline-offset: 3px` on every interactive element. Motion: 200 ms colour transitions only, none under reduced motion. No shadows, gradients, rounded corners or dark mode.

### Measured (2026-10-30, headless Edge)
Grid box 100 / 100 / 91.7% of the window at 1280 / 1440 / 1920 px; no horizontal overflow at 375-1920 px; smallest tap target 44 px; print is black on white.

### Header
`web/src/components/SiteHeader.tsx` with `web/src/components/NavLinks.tsx`: the brand at left; Patterns, Verify a receipt and About at right in `--swiss-text`, the current page black and underlined (`aria-current="page"`), each a 44 px tap area; the links wrap onto a second row on narrow screens.

### Home form and ?example=
`web/src/components/ExampleCheckForm.tsx` (server) reads `?example=<rule_id>` and passes the validated example to `CheckForm`, which shows it in the box with "Example from the pattern library: <name>. Edit it or press Check." and the demo label; the page wraps it in `<Suspense>` with the empty form as fallback.

### What the levels mean
Under the risk meter, `RiskBadge` has a `<details>` block (summary "What the levels mean", 44 px) listing Low signals, Elevated and High with the same sentences as the card, then the ceiling note from `RISK_CEILING_NOTE`. Closed by default, so the result stays short.

### One-time New line
On the first result in a browser session, `RiskCard` shows one small line under the risk badge: "New: signed receipt, what was checked, and an 'I already paid' plan are below." (without "signed receipt" when the check returned none). `web/src/lib/new-line.ts` records a single flag (`scamlens:new-line-seen`, no text) in sessionStorage inside try/catch; with storage blocked it still appears at most once per page. Hidden in print. /about lists the flag under "Privacy: what is stored".

### Beyond the check
`web/src/components/BeyondTheCheck.tsx`: three `.card` entries (title, one sentence, a link) pointing to /patterns (the count comes from `RULES.length`), /verify and /about. Shown under the form before a check and after the result once there is one, so it never pushes the answer down; hidden in print.

### Link graph canvas
White background, 1px grey links, 2.5px alert links on evidence paths only (matched by node id), black filled (checked) and hollow (others) circles, black 12 px labels below each circle on a white halo. Zoomed to fit with 40 px padding; 300 px tall on phones, 360-480 px otherwise. Screenshots: `docs/screens/graph-fit-375.png`, `graph-fit-768.png`, `graph-fit-1440.png`.

### Share preview
`web/src/app/opengraph-image.tsx` (1200x630, generated at build time with `next/og` and its built-in font, so no web font is loaded) and `web/src/app/icon.svg` use the palette only: white, black, secondary text and the rule colour. `web/src/lib/launch.test.ts` checks the colours.

## Where in the code

- `web/src/app/globals.css`: tokens, type, grid, components.
- `web/src/components/`: all components.
- `web/src/lib/style.test.ts` and `web/src/lib/contrast.test.ts`: enforcement.
- `docs/UI_CHECKLIST.md`: manual and browser checks.
- `docs/screens/`: before, after and live screenshots.

## How to change it safely

Use only the tokens; a new colour needs the owner's approval and an update to both tests. Never use Tailwind's own palette classes (`text-black`, `bg-white` are banned too). Keep text colours to black, `--swiss-text`, white on black, clay and alert (High only).

## How it is tested

`web/src/lib/style.test.ts` (palette allow-list, no shadows/gradients/rounded/dark mode, 200 ms colour-only transitions, font stack), `web/src/lib/contrast.test.ts` (WCAG ratios computed from the CSS; where grey, tan and alert may appear), render tests in `web/src/lib/ui.test.ts`, and browser runs recorded in `docs/PROGRESS.md`.

## Known limits

Hover colours and screen-reader announcements still need a person to check (`docs/UI_CHECKLIST.md`).
