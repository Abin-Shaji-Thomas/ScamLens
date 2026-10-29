# Tech stack

## In plain words

ScamLens uses a small, mainstream stack: Next.js (React) for pages and server functions, TypeScript everywhere, Tailwind for styles, zod to validate every input, Supabase Postgres for reports, TigerGraph for the link graph, and Vitest for tests. No web fonts, no analytics, no third-party scripts. New dependencies need the owner's approval.

## Details

| Technology | What it is | Why chosen | Alternatives rejected | Used in |
|---|---|---|---|---|
| Next.js 16 (App Router) | React framework with server routes | One deploy for pages and APIs on Vercel; static pages are fast | Separate API server (more moving parts) | `web/src/app/` |
| React 19 | UI library | Comes with Next.js | – | `web/src/components/` |
| TypeScript (strict) | Typed JavaScript | Catches mistakes early; required by the spec | Plain JS | everywhere |
| Tailwind CSS 4 | Utility CSS | Fast to style; tokens mapped to CSS variables | Hand-written CSS only | `web/src/app/globals.css`, components |
| zod 4 | Runtime validation | Every API boundary validates input and output | Manual checks | `web/src/lib/api-schema.ts`, `web/src/lib/reports/schema.ts`, sources |
| viem | Ethereum utilities | EIP-55 checksum validation | ethers (heavier) | `web/src/lib/extract/crypto.ts` |
| bs58check | Base58Check decoding | TRON and legacy BTC checksums | – | `web/src/lib/extract/crypto.ts` |
| tldts | Domain parsing | Correct public-suffix handling for domains and emails | Regex only | `web/src/lib/extract/contact.ts` |
| fast-xml-parser | XML parser | Reads the OFAC SDN XML in the sync script | – | `web/scripts/sync-lists.ts` |
| @supabase/supabase-js | Supabase client | Calls the SQL functions with the service-role key | Direct Postgres driver (connection limits on serverless) | `web/src/lib/reports/db.ts` |
| TigerGraph (REST) | Graph database | Multi-hop link queries across reports (track requirement) | Postgres only (kept as fallback) | `web/src/lib/graph/tigergraph.ts`, `graph/` |
| react-force-graph-2d | Canvas graph drawing | Simple force layout for the link view | D3 by hand | `web/src/components/GraphPanel.tsx` |
| openai (SDK) | OpenAI-compatible client | Optional AI pass and screenshot reading; any compatible provider via base URL | Provider-specific SDKs | `web/src/lib/signals/llm.ts`, `web/src/lib/transcribe.ts` |
| node:crypto | Built-in crypto | HMAC hashing, Ed25519 receipts | External libraries | `web/src/lib/reports/privacy.ts` |
| Vitest | Test runner | Fast, TypeScript-native | Jest | `web/src/**/*.test.ts` |
| @electric-sql/pglite | Postgres in WebAssembly (dev only) | Runs the real SQL in tests without a server | Mocking SQL | `web/src/test-support/pglite.ts` |
| tsx | Runs TypeScript scripts | Scripts and the eval | ts-node | `web/scripts/`, `eval/run.ts` |
| ESLint | Linter | Next.js defaults | – | `web/eslint.config.mjs` |

Exact dependency list (generated from `web/package.json`):

<!-- GENERATED:START deps -->
| package | version | kind |
|---|---|---|
| `@supabase/supabase-js` | ^2.118.0 | runtime |
| `bs58check` | ^4.0.0 | runtime |
| `fast-xml-parser` | ^5.11.2 | runtime |
| `next` | 16.4.3 | runtime |
| `openai` | ^7.45.1 | runtime |
| `react` | 19.3.0 | runtime |
| `react-dom` | 19.3.0 | runtime |
| `react-force-graph-2d` | ^1.29.2 | runtime |
| `tldts` | ^7.4.19 | runtime |
| `viem` | ^2.57.13 | runtime |
| `zod` | ^4.6.7 | runtime |
| `@electric-sql/pglite` | 0.5.8 | dev only |
| `@tailwindcss/turbopack` | ^4 | dev only |
| `@types/node` | ^24.19.2 | dev only |
| `@types/react` | ^19 | dev only |
| `@types/react-dom` | ^19 | dev only |
| `eslint` | ^9 | dev only |
| `eslint-config-next` | 16.4.3 | dev only |
| `tailwindcss` | ^4 | dev only |
| `tsx` | ^4.23.15 | dev only |
| `typescript` | ^5 | dev only |
| `vitest` | ^5.0.5 | dev only |
<!-- GENERATED:END deps -->

## Where in the code

- `web/package.json`: dependencies and npm scripts.
- `web/next.config.ts`: Next.js configuration and headers.
- `web/vitest.config.mts`: test configuration.
- `web/tsconfig.json`: TypeScript settings.

## How to change it safely

Do not add a dependency without the owner's approval (a standing project rule). Read `node_modules/next/dist/docs/` before using a Next.js API: this version has breaking changes (for example, cookies, headers and params are async).

## How it is tested

`npm run typecheck`, `npm run lint`, `npm run build` and `npm test` must all pass before every commit.

## Known limits

The `openai` package is installed but unused at runtime in this deployment because no AI key is configured.
