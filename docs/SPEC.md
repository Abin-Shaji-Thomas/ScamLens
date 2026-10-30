# ROLE AND WORKING RULES
You are building ScamLens, solo, for Hacker House Goa 2026 (Crypto x AI track, team ArcReap). Repo: github.com/Abin-Shaji-Thomas/ScamLens. Judges ask: is it live, does it work, is anyone using it. Submission is due 31 Oct 2026. I am on Windows 11 with PowerShell, so use PowerShell-compatible commands.

1. Step 0: save this entire prompt verbatim to docs/SPEC.md and commit it. Re-read it at the start of every milestone.
2. Step 1: audit the repo (git log --oneline -10, directory tree, web/package.json, web/src/lib). Report what exists and what is missing. Extend working code; never overwrite it.
3. Work in milestones M1-M6. For each one: state a plan in 5 lines or fewer, build, run EVERY command in its VERIFY list, and show the real output. Then print a PASS/FAIL table. If anything fails, fix it and rerun. Commit only when all pass (message "M<n>: ..."), then STOP and wait for me to say "next".
4. Never invent data, sources, API responses, accuracy numbers or reports. Before coding against any external URL, fetch it with curl and confirm it returns real data. If it fails, tell me and use the stated fallback.
5. Secrets: read them only via process.env from web/.env.local. Never print, log or commit values, and never ask me to paste them. Check presence by variable name only. Keep .env.local gitignored and maintain web/.env.example (names only).
6. Ask me before creating accounts, deploying, deleting files, or installing anything beyond the packages listed here.
7. Code standards: TypeScript strict, zod validation on every API boundary, small files.

# PRODUCT
ScamLens is an evidence-linked scam check for India. The user pastes a suspicious chat, screenshot text, wallet address, UPI ID or Telegram handle. They get a risk card showing what is PROVEN, what is REPORTED and what is only SUSPECTED, each with its source.
Out of scope: no scammer baiting, no claim of a complete scam database, no storing raw chats or screenshots (process in memory only).

# THREE EVIDENCE TIERS (never mixed)
- VERIFIED: facts we check ourselves. Sources: on-chain history (Etherscan V2 multichain, TronGrid), OFAC sanctions list, ScamSniffer open blacklist (public copy is ~7 days delayed; say so in the UI), GoPlus address security. Every line shows source, date and link.
- REPORTED: user reports from our own database. Shown only after 2 independent submitters. Wording is always "reported", never "scammer". UPI has no public database, so UPI is user-reported only and never shown as verified.
- SUSPECTED: AI/rule pattern signals from the user's own text. Each shows the exact quoted phrase and the rule that fired.
RISK LEVELS (Low / Elevated / High signals): the AI alone can never produce High. High requires at least one VERIFIED match, OR (2 independent reports AND at least 1 suspected signal). Low is labelled "Low signals - not a safety guarantee". Empty database shows: "No known reports. This does not mean safe."
Failure rule: if any API fails or times out, show "unavailable" for that source. Never show it as safe.

# STACK, LAYOUT, ENV
Next.js (App Router, TS, Tailwind, src dir), Supabase (Postgres), TigerGraph Savanna, OpenAI-compatible LLM, Vercel (root directory = web), vitest, tsx.
Packages: zod viem bs58check tldts openai @supabase/supabase-js fast-xml-parser react-force-graph-2d; dev: vitest tsx.
Layout: web/ (app), graph/ (schema.gsql + queries), eval/ (40 labelled chats + score script), scripts/ (sync-lists.ts), docs/SPEC.md.
Env names (web/.env.local): OPENAI_API_KEY, OPENAI_MODEL, ETHERSCAN_API_KEY, TRONGRID_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TG_HOST, TG_GRAPH, TG_SECRET.
If TigerGraph or the LLM key is unavailable, build against interfaces with the fallbacks below and tell me.

# M1 - DEPLOYED SKELETON
BUILD: paste box, Check button, and an empty risk card with the three tier sections. GET /api/health returns {ok:true}. Add npm scripts: lint, typecheck, test.
VERIFY: `npm run lint`, `npx tsc --noEmit`, `npm run build`. Run `npm run dev` and `curl http://localhost:3000/api/health`. I deploy to Vercel myself; ask me for the live URL, then verify `curl -I <url>` returns 200 and <url>/api/health returns ok.

# M2 - IDENTIFIER EXTRACTOR (the trust anchor: AI proposes, code disposes)
BUILD web/src/lib/identifiers.ts. Each result is {type, value, raw, start, end, check:"checksum"|"format"}. Types:
- EVM: mixed-case must pass the EIP-55 checksum.
- TRON: Base58Check, version byte 0x41, 21-byte payload.
- BTC: legacy Base58Check plus bech32.
- UPI: handle@psp format only (check:"format"). If the part after @ contains a dot, treat it as an email.
- Indian phone: +91 or 10 digits starting 6-9, normalised to +91XXXXXXXXXX.
- Telegram: @name (5-32 chars) and t.me links.
- Email and domains (tldts).
Invariant: text.slice(start,end) === raw for every result.
VERIFY: vitest with at least 25 tests: known-valid addresses taken from official docs (cite the source in a comment), invalid ones made by flipping one character, UPI vs email ambiguity, empty result for text with no identifiers, and a randomized test of the slice invariant. Show the vitest output.

# M3 - VERIFIED TIER
BUILD:
- scripts/sync-lists.ts downloads the OFAC SDN list (find the current official Treasury URL, parse digital-currency addresses with fast-xml-parser) and the ScamSniffer scam-database address blacklist. Write versioned JSON to web/data/ with fetched_at and source URL.
- src/lib/verified/{ofac,scamsniffer,goplus,etherscan,tron}.ts. Etherscan V2 returns first/last tx time, tx count, balance and contract-vs-EOA for Ethereum, BNB, Polygon, Base and Arbitrum.
- POST /api/check {text}: extract identifiers, run checks in parallel with a 5s timeout each, return the tier objects.
VERIFY: unit tests with mocked fetch. Run a live smoke script (npx tsx scripts/smoke-verified.ts) with one address taken FROM the downloaded OFAC file and one clean address, and show the output. Test that a missing key or timeout produces "unavailable", never "safe".

# M4 - SIGNALS ENGINE AND RISK RULES
BUILD src/lib/signals/rules.ts with at least 15 fixed rules {id, label, patterns}. Cover:
- guaranteed or daily returns; pay-to-unlock or withdrawal fee; urgency or deadline
- seed phrase or private key request; move to Telegram or WhatsApp; remote-access app request
- police/CBI/customs impersonation and "digital arrest"; fake KYC or refund
- like-and-earn tasks; romance plus investment
- pay a third party's account; "send a small amount first"; screenshots of fake profits
Two passes: a deterministic regex pass, and an LLM pass that may ONLY return {rule_id, quote}. Code drops any item whose rule_id is not in the list or whose quote is not an exact substring of the input (after whitespace normalisation). Implement src/lib/risk.ts exactly per the tier rules above.
VERIFY: tests for a hallucinated quote being dropped; AI-only input with 5 signals never yields High; one test per risk branch; the no-evidence message.

# M5 - REPORTS AND GRAPH
BUILD:
- Supabase reports table: identifier_type, identifier_hash, identifier_display (masked), reporter_fingerprint_hash, category, created_at, expires_at (+90 days), contested, synthetic. A consent checkbox is required. Store no raw chats. Rate-limit per fingerprint. One fingerprint counts once per identifier. The public "Reported" badge appears only with 2 or more distinct fingerprints within 90 days. Add a "contest this entry" endpoint.
- Hub filter: ignore identifiers linked to more than N distinct counterparties (N configurable), or on an exchange-address list, so unrelated people are not linked.
- graph/schema.gsql with vertices Wallet, UPI, TelegramHandle, Phone, Domain, Report, plus four queries:
  Q1: UPI -> wallet -> Telegram, linked only through a shared wallet.
  Q2: wallet -> 2 hops of payments -> flagged address.
  Q3: different Telegram handles telling victims to pay the same wallet, with cluster size.
  Q4: neighbourhood for the graph view.
- TigerGraph via REST using TG_HOST, TG_GRAPH and TG_SECRET (request a token). Fallback: a Postgres recursive CTE behind the same `findLinks` function.
- UI: react-force-graph-2d showing each path with explanatory evidence text.
VERIFY: tests for the 2-reporter rule and the hub filter. Seed synthetic data (flagged synthetic=true). Run Q1-Q3 on the seed and show the real output. Confirm the Postgres fallback returns the same answers.

# M6 - EVAL, EVIDENCE PACK, README, DEMO
BUILD:
- eval/chats.json with 40 SYNTHETIC labelled chats (20 scam, 20 normal), labelled as synthetic. Include hard negatives: genuine bank alerts, exchange notices, a friend asking for a UPI payment. eval/run.ts reports accuracy, precision, recall and false positives, with the model name and date.
- Evidence pack generator: copy-ready plain text with verified/reported/suspected clearly separated, plus next steps: call 1930, file at cybercrime.gov.in, contact your bank. Not legal advice.
- README that matches the demo exactly, including a Limitations section, plus a 90-second demo script with 3 sample inputs. All demo data carries the watermark "Illustrative - not a real investigation".
VERIFY: run `npm run eval` and show the table unaltered. Run `npm run lint && npx tsc --noEmit && npm test && npm run build`. Confirm the live URL works end to end with the 3 sample inputs. Run `rg -i "scammer" web/src` and confirm no accusatory wording is attached to any identifier.

# GUARDRAILS
- Wording: "reported", "linked", "suspected". Never "scammer".
- Identifiers in public views are masked; only hashes are stored for matching.
- Reports expire after 90 days. Contested entries are hidden from public badges until reviewed.
- Stretch only after M6: screenshot input where the AI transcribes the image and the M2 extractor then validates every identifier in the transcript.
- Cut line: if time runs short, ship M1-M4 plus the M6 README and eval, and tell me before cutting M5.

# FIRST ACTIONS
Do Step 0 and the Step 1 audit now. Report the findings, then wait for my "next" before starting M1.

# FINAL DECISIONS (finishing run F0-F8, 2026-10-29; these override the sections above where they differ)
- No accounts, sign-in, OAuth or sessions. Reports, daily limits and contests are keyed to a network fingerprint = HMAC(REPORT_HASH_PEPPER, client IP). The User-Agent is no longer part of it (F1). /about states the consequences (shared networks count once; several networks can count several times).
- Graph links (Q1, Q3) require two different reporters (`reporter_key` on edges), not just two submissions.
- No new runtime dependencies. @electric-sql/pglite is a dev dependency for SQL tests only.
- Hard limits (web/src/lib/limits.ts): 6,000 text characters, 1,500,000-character image data URLs, 20 identifiers, 10 graph lookups; enforced with zod and plain 400/413 messages that never echo input.
- Abuse guard (web/src/lib/usage.ts): Supabase `usage_counters` + `increment_usage` (security definer, empty search_path, service_role only) with an in-memory fallback. Defaults per fingerprint per day: check 40, transcribe 10, graph 100, contest 3; reports keep REPORTS_MAX_PER_DAY (5); global 1,500 LLM-using calls per day. Over a limit: 429 + Retry-After, no external calls. Store failure: AI pass skipped with a notice, rule checks continue.
- Screenshot input (stretch goal, built in F3): the model only transcribes; the user edits and confirms; only the confirmed text is checked by the normal extractor and rules. Images and transcripts are never stored or logged. Without a vision key the UI asks users to paste text.
- Safe logging only: event name, status, duration (web/src/lib/log.ts); no other console calls in app code.
- One demo label everywhere: "Illustrative demo data - not a real investigation" (replaces "Illustrative - not a real investigation").
- Banned in user-facing text (test-enforced over web/src): scammer, fraudster, criminal, guilty, confirmed scam.
- Etherscan: free-plan chains only (Ethereum, Polygon, Arbitrum One; probed in docs/CHAIN_SUPPORT.md), first EVM wallet per check, at most 2 chains in flight. BNB Chain and Base need ETHERSCAN_PLAN=paid. The SPEC's five-chain list above describes the paid plan.
- ScamSniffer domain list: not used (9.1 MB > 8 MB budget); checks with a domain show a notice.
- Rules: 18 fixed rules run on a de-obfuscated copy of the text with offsets mapped back; move_platform needs a second rule to count; narrow guards for the original 4 eval false positives. The eval (66 synthetic cases) writes eval/RESULTS.md; the README quotes only that file.
- /about is the trust page (sources, licences, dates, privacy, independence rule, contest, emergency steps), with all numbers taken from code constants; every page has a footer link to it.
- /api/health returns booleans and short statuses only, makes no network calls, and never echoes env values.

# ROUND 2 DECISIONS (G0-G5, 2026-10-29, branch round2; these override the sections above where they differ)
- CSP keeps script-src 'self' 'unsafe-inline' because Next.js 16 emits inline <script> tags (measured in the build output); no remote origins anywhere; 'unsafe-eval' only in development. scripts/check-headers.ts verifies a running server.
- Contest policy: a contested report stays visible, labelled "Contested, under review", and counts as a weak signal only (Elevated at most, never High). A moderator upholds (removes reports) or dismisses (clears the label) in the SQL editor (docs/MODERATION.md). Contest reasons (10-500 characters) are stored for the moderator only and never rendered. Schema change in web/db/migrations/002_contest_policy.sql; before it runs, reads fall back to the old function and new contests are refused.
- Warning context: rule hits inside warning, news or awareness sentences are shown under "Mentioned in a warning or news-style text" but carry no weight. Markers are protective phrases (beware, red flag, awareness, advisory, never/do not + advice, news:, police said, Hinglish savdhan/satark/...). Scope: same sentence, or the previous sentence of the same message when this sentence continues it. The "digital arrest" rule ignores advice not to trust such calls; "lucky draw" needs a second-person, claim or payment word nearby.
- The eval counts only non-warning hits (same as the risk card). 74 synthetic cases (8 added in round 2).
- Design: minimalist and typographic. Palette #ffffff / #111111 / #767676 / #eeeeee only, as CSS variables; system sans-serif stack; weights 400/600; body 16/26, small 14/22, headings 20/28, title 40/44 (32/36 mobile); 40rem column; no boxes, borders (except hairlines between tiers and above the footer), shadows, rounded corners, colour coding or dark mode; flat square buttons; 2px ink focus outline; grayscale graph; reduced motion respected. Enforced by web/src/lib/style.test.ts. next/font (Geist) removed.

# UI ROUND DECISIONS (Minimalism & Swiss Style, 2026-10-30, branch ui-swiss; these override the round 2 design where they differ)
- Why: at 1908 px the 40rem column used about 30% of the window. The layout is now a 12-column grid, max 110rem (1760 px), padding clamp(3rem, 6vw, 6rem) clamp(1.25rem, 4vw, 3rem), one column below 768 px; every top-level part of a page is a full-width section so paper bands are full-bleed. Measured: 92-93% of the window at 1280-1440 px, 91.7% at 1920 px.
- Palette changed on purpose (the round 2 four-colour test was updated, not deleted): black, white, paper #f5f1e8, text #4b5563, rule #e5e7eb, grey #808080, tan #b38b6d, clay #7a4f32, alert #b00020, black-hover #1f2937.
- Grey and tan never carry text. Grey is 3.95:1 on white and tan 3.07:1: they pass the 3:1 bar for lines and UI parts but fail the 4.5:1 bar for text. Tan is 2.73:1 on paper, so it is never used on paper (card hover rule there is clay). Alert appears only for High (word and meter) and the graph's evidence-path links, so red always means "strongest evidence". Enforced by web/src/lib/contrast.test.ts.
- Risk level shown three ways (word, bold underlined position in "Low signals · Elevated · High", 1/2/3-segment meter), never by colour alone.
- Type: system stack "Helvetica Neue", Helvetica, "Segoe UI", Roboto, Arial, sans-serif; weight 300 only at 28 px and above; body 1.125rem/1.6; small text 14 px minimum; uppercase by CSS only. Measured on Windows: Helvetica is aliased to Arial (registry FontSubstitutes), so the stack never reaches Segoe UI Light and headings render at 400; the design was checked at that weight.
- The only new on-screen text is decorative numerals (tier 01-03 and the 404 page's "404"), both aria-hidden. Every other string is unchanged; the 404 link keeps "Go to the check".
- An evidence-path link is a graph link whose two end labels both appear in one listed path (Q1-Q3), computed in the browser; the graph API is unchanged.
- /api/health adds "build" (first 7 hex characters of VERCEL_GIT_COMMIT_SHA, else "local"); nothing else is echoed.

# TIGERGRAPH AND GRAPH UI DECISIONS (2026-10-30, branch tg-finish; these override earlier sections where they differ)
- The automated run may run tg-setup, install queries, load data and check parity on graph ScamLens with the graph-scoped token only. It never drops anything, never touches Transaction_Fraud, and never attempts a global schema change: tg-setup reads the schema and, if a migration is missing, stops with "HUMAN STEP REQUIRED" and the exact GSQL for the owner (migration 001 was applied by hand; it adds `Report.reporter_key STRING DEFAULT ""`).
- TigerGraph error messages include the response detail, masked and capped at 800 characters. The long query install is retried on a dropped connection.
- Q2 works on the demo data (4 of 7 demo wallets have a path); tg-setup reports how many cases return rows. No extra demo seeding.
- The link graph zooms to fit its canvas (40 px padding) when the layout settles and after a resize; 300 px tall on phones, 360-480 px otherwise; labels below nodes on a white halo; colours unchanged.
- `/api/graph` returns optional `elapsedMs`; the note reads "Graph backend: tigergraph (N ms)"; the fallback label is unchanged.
- The coverage ledger shows a "Link graph" row driven by the page's own lookup; the signed receipt's coverage does not include it, so receipts are unchanged.
- After a result, up to 3 reported identifiers get a background graph lookup (one at a time, graph daily limit) and one plain sentence when links exist, with "A link is not proof of wrongdoing."; failures show nothing.
- /about has a "Link graph" section with live counts from `GET /api/graph/stats` (TigerGraph built-in statistics, Postgres fallback, 5-minute cache, graph limit, counts only); /about stays static.
- `/api/health` keeps its shape; `"graph":"tigergraph"` means configured, not awake.
- Font stack: "Helvetica Neue", "Segoe UI", Roboto, Helvetica, Arial, sans-serif, so Windows uses Segoe UI Light for weight 300.
- PGlite suites run with explicit 30 s timeouts (start-up under parallel load); smoke-live warms up before counting expectations.

# TYPOGRAPHY: Arial-first stack, regular headings, identical on every OS, matching the owner's localhost look (2026-10-30, branch finish)
- Font stack: Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, sans-serif. System fonts only, no web fonts. This replaces the Segoe UI ordering of the TigerGraph finish round.
- Two weights only: 400 for all text and headings (title, risk word, 404, section headings, step numerals) and 600 for small bold labels, finding titles and the brand. No weight 300 anywhere; `font-synthesis: none`.
- Sizes, line heights, grid and colour tokens are unchanged. Verified in headless Edge against a reference built from the pre-056ab4b stack: identical font files, sizes, widths and line counts at 375, 768, 1280, 1440 and 1920 px.

# DOMAIN CHECK: GoPlus phishing sites (2026-10-30, branch finish)
- Probe: `GET https://api.gopluslabs.io/api/v1/phishing_site?url=<domain>`, no key; `phishing_site` 1 for the phishing domain in GoPlus's API example, 0 for example.com and a reserved demo domain.
- Built: source `goplus_phishing` ("GoPlus phishing sites"), up to 5 domains per check, only the domain is sent. Listed = Verified match (counts toward High); not listed = no_match, worded "does not list", never "safe"; any failure = unavailable.
- The domain notice now reads "Website domains are checked only against GoPlus's phishing-site list (ScamSniffer's domain list is too large for this deployment). Not being listed does not mean the site is safe." The 2026-10-29 decision not to load ScamSniffer's domain list stands.

# COMMUNITY CASES AND FEEDBACK (2026-10-30, branch final)
- Owner decision: no accounts; contributions optional; the ordinary check is never stored. Promise: "Your check is never stored. If you choose to contribute a case, we store structured facts and, only if you tick it, a redacted excerpt you reviewed, visible only to the moderator, deleted with your delete code or after 90 days."
- Migration 004 adds cases and feedback; a case goes through submit_report, so the 2-independent-reporter rule applies unchanged. Feedback is display only and never changes a level.
- Delete codes: 128 random bits shown once; only an HMAC with the pepper is stored. No delete code, no excerpt.

