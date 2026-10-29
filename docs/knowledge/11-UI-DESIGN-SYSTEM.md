# UI design system

## In plain words

The interface follows Minimalism & Swiss Style: a 12-column grid that fills the window up to 1760 px, large light headings, lots of white space, 2 px black rules instead of boxes, and ten fixed colours. Colour never carries meaning on its own: the risk level is a word, a bold underlined position and a meter. Grey and tan never colour text, because they are too faint to read.

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
- Font stack: `"Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif` (system fonts only; no web fonts). On Windows, "Helvetica" maps to Arial, which has no light face, so headings render at 400 there (measured 2026-10-30).
- h1 `.t-title`: weight 300, `clamp(2.5rem, 6vw, 6rem)` / 1.05. Risk word `.t-risk`: `clamp(3rem, 8vw, 8rem)`. 404 numeral `.t-404`: `clamp(6rem, 20vw, 16rem)`.
- Section headings `.t-h2`: 1.5rem, weight 400 (weight 300 only at 28 px and above). Body 1.125rem / 1.6. Small `.t-small`: 0.875rem / 1.5, never below 14 px. `.eyebrow`: 0.875rem, 0.1em tracking, uppercase by CSS only.
- Reading text is capped at 65ch.

### Grid
`.grid`: 12 columns, gap `clamp(1rem, 2vw, 2rem)`, max 110rem, padding `clamp(3rem, 6vw, 6rem) clamp(1.25rem, 4vw, 3rem)`; one column below 768 px. Every top-level part of a page is a full-width `<section>` holding one `.grid`, so a `.band` background is full-bleed.

### Components
`.card` (2px black top rule, hover tan on white, clay on a band), `.button` (black, square, 44 px minimum, uppercase by CSS), `.button--outline`, `.btn-link` (underlined, 44 px tap height), `.textarea` (2px black top rule, 1px light rule below), `.field` (1px black underline), `.meter` / `.meter__seg`, `.steps` (large light numerals), `.tap` (44 px tap area for links inside sentences). Focus: `outline: 2px solid var(--swiss-black); outline-offset: 3px` on every interactive element. Motion: 200 ms colour transitions only, none under reduced motion. No shadows, gradients, rounded corners or dark mode.

### Measured (2026-10-30, headless Edge)
Grid box 100 / 100 / 91.7% of the window at 1280 / 1440 / 1920 px; no horizontal overflow at 375-1920 px; smallest tap target 44 px; print is black on white.

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
