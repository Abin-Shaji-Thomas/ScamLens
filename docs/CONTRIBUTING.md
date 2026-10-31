# Contributing

Thank you for helping. ScamLens is small on purpose: every claim on the site must be backed by a test or a real source, and nothing may call a person a scammer.

## Setup

```
cd web
npm ci
cp .env.example .env.local   # names only; every value is optional for local work
npm test                     # vitest, including the docs and eval data checks
npm run dev                  # http://localhost:3000
```

Without Supabase, TigerGraph or keys the app still runs: reports, the link graph and the scam trail show as unavailable or off, never as clean. `npx tsx scripts/graph-demo.ts` and `npx tsx scripts/seed-india-cases.ts --local` exercise the graph in an in-memory Postgres.

## Rules for every change

- Run the gate before a commit: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run docs:generate`, `npm run docs:check`. All must pass.
- Add tests for every new behaviour, in both directions where a rule can fail either way. Never weaken a test to make it pass.
- Update every doc that mentions what you changed, in the same commit (`docs/knowledge/MANIFEST.json` lists which doc covers which code; `docs/knowledge/17-CHANGELOG.md` always). Numbers that come from the code go in FACT markers.
- Add no dependency without the maintainer's approval.
- Use synthetic identifiers only (`zzdemo.*@okdemo`, `@zzdemo_*`, `example.com`, wallets from `web/scripts/gen-synthetic-wallets.ts`). Never a real person's number, UPI ID, handle or wallet.
- Conventional Commits, one logical change per commit.

## How to add...

- **A pattern rule:** add it to `web/src/lib/signals/rules.ts` and its plain-language entry to `web/src/lib/signals/pattern-guide.ts` (with an example that triggers it). Add a scam case and a hard negative to `eval/chats.json` (append only), run `npm run eval` (it must stay at 0 false positives and 0 false negatives) and `npx tsx scripts/redos-check.ts`.
- **A data source:** add a module under `web/src/lib/verified/`, register it in `index.ts` (every failure must become "unavailable"), add it to `SOURCES` in `web/src/lib/coverage.ts`, describe it on `/about#sources` and in `docs/knowledge/05-DATA-SOURCES.md` with its licence.
- **A database change:** a new idempotent file `web/db/migrations/NNN_name.sql` (service-role grants like 002-004). The code must work before and after it runs. Running it on Supabase is a human step (`docs/HUMAN_TASKS.md`).

## Questions

Write to <!-- FACT:contact_email -->scamlenspvt@gmail.com<!-- /FACT --> or <!-- FACT:x_handle -->@scamlens<!-- /FACT --> on X. Security issues: see [SECURITY.md](../SECURITY.md).
