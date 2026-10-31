<p align="center"><img src="../assets/logo-512.png" width="96" alt="ScamLens logo"></p>

# ScamLens knowledge base

## In plain words

This folder explains ScamLens to someone who has never seen it: what it is for, how each part works, why it was built that way, and how to change it without breaking anything. Start with [00-START-HERE.md](00-START-HERE.md). Every file follows the same six headings, and tables marked "generated" are rebuilt from the code, so they cannot drift.

## Details

| File | What it covers |
|---|---|
| [00-START-HERE.md](00-START-HERE.md) | What ScamLens is, a worked example, and a glossary |
| [01-PROBLEM-AND-SOLUTION.md](01-PROBLEM-AND-SOLUTION.md) | The problem, the three tiers, what ScamLens is not |
| [02-HOW-IT-WORKS.md](02-HOW-IT-WORKS.md) | The check pipeline step by step |
| [03-ARCHITECTURE.md](03-ARCHITECTURE.md) | Components, data flow, what runs where, failure behaviour |
| [04-TECH-STACK.md](04-TECH-STACK.md) | Every technology, why, and where it is used |
| [05-DATA-SOURCES.md](05-DATA-SOURCES.md) | OFAC, ScamSniffer, GoPlus, Etherscan, TronGrid |
| [06-SIGNAL-RULES.md](06-SIGNAL-RULES.md) | The fixed pattern rules (generated table) |
| [07-RISK-ENGINE.md](07-RISK-ENGINE.md) | How Low / Elevated / High is decided |
| [08-REPORTS-AND-PRIVACY.md](08-REPORTS-AND-PRIVACY.md) | Community reports, independence, hashing, retention |
| [09-GRAPH.md](09-GRAPH.md) | The link graph (TigerGraph and the Postgres fallback) |
| [10-SECURITY-AND-ABUSE.md](10-SECURITY-AND-ABUSE.md) | Threat model, headers, limits, receipts |
| [11-UI-DESIGN-SYSTEM.md](11-UI-DESIGN-SYSTEM.md) | Swiss-style tokens, grid, components |
| [12-TESTING-AND-EVAL.md](12-TESTING-AND-EVAL.md) | Tests by file and the synthetic evaluation |
| [13-OPERATIONS.md](13-OPERATIONS.md) | Environment variables, deploy, warming, rollback |
| [14-DEMO-AND-JUDGING.md](14-DEMO-AND-JUDGING.md) | Demo scripts, judge questions, claims and evidence |
| [15-DECISIONS-LOG.md](15-DECISIONS-LOG.md) | Every major decision and why |
| [16-KNOWN-GAPS-AND-ROADMAP.md](16-KNOWN-GAPS-AND-ROADMAP.md) | What is missing and what could come next |
| [17-CHANGELOG.md](17-CHANGELOG.md) | Changes by day |
| [18-RELEASE-READINESS.md](18-RELEASE-READINESS.md) | The final quality gate results |
| [19-DISTINCTIVE-FEATURES.md](19-DISTINCTIVE-FEATURES.md) | Coverage ledger, "I already paid", signed receipts, scam trail, community loop, pattern library |
| [20-LAUNCH-KIT.md](20-LAUNCH-KIT.md) | Share preview and post drafts |

Other documents (also checked by `npm run docs:check` for facts, links and stale phrases):

| File | What it covers |
|---|---|
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | System context, one check step by step, data model and deployment diagrams, failure behaviour |
| [../API.md](../API.md) | Every route: method, limits, request and response shapes, status codes |
| [../DATA-MODEL.md](../DATA-MODEL.md) | Tables, functions, TigerGraph schema, migrations in order |
| [../PRIVACY.md](../PRIVACY.md) | Data inventory, retention, deleting, what moderators see |
| [../DATASET.md](../DATASET.md) | The Indian synthetic dataset and the public sources each campaign follows |
| [../THIRD_PARTY.md](../THIRD_PARTY.md) | Packages, data licences, hosted services |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Setup and rules for changes |
| [../HUMAN_TASKS.md](../HUMAN_TASKS.md) | What only the owner can do, in order |
| [../../SECURITY.md](../../SECURITY.md) | How to report a vulnerability |

Special markers (do not edit their contents by hand):
- `<!-- GENERATED:START <name> -->` ... `<!-- GENERATED:END <name> -->`: a block rebuilt from the code by `npm run docs:generate`.
- `<!-- FACT:<name> -->value<!-- /FACT -->`: one number or phrase inside a sentence, refreshed the same way.

## Where in the code

- `web/scripts/docs-lib.ts`: the generators and checks (pure functions).
- `web/scripts/docs-generate.ts`: rewrites generated blocks and facts.
- `web/scripts/docs-check.ts`: fails when the docs drift from the code.
- `docs/knowledge/MANIFEST.json`: which doc describes which source files.
- `web/src/lib/docs.test.ts`: runs the offline checks as part of `npm test`.

## How to change it safely

1. Change the code.
2. Update the doc that MANIFEST.json maps to that code, and add a line to [17-CHANGELOG.md](17-CHANGELOG.md), in the same commit.
3. From `web/`: `npm run docs:generate`, then `npm run docs:check`. Both must succeed before you commit.
4. Never hand-edit inside a generated block or a fact marker; change the code or the generator instead.
5. If something is not verified, write UNKNOWN rather than guessing.

## How it is tested

`npm run docs:check` fails when a generated block or fact is stale (here and in `README.md`, `docs/DEPLOY.md`, `docs/HUMAN_TASKS.md` and `docs/UI_CHECKLIST.md`), a doc repeats a phrase listed in `docs/knowledge/STALE_PHRASES.json` (the changelog and decisions log are exempt, as history), a required file or heading is missing, an internal link is broken, a path under "Where in the code" does not exist, a quoted UI string contains a banned word, or a source file mapped in MANIFEST.json changed (against `origin/main`) without its doc and the changelog. `npm test` runs the same offline checks (everything except the git comparison) in `web/src/lib/docs.test.ts`.

## Known limits

- The checker verifies numbers only where they are wrapped in a FACT marker or a generated block; a number typed as plain prose is not checked.
- Stale phrases are caught only when someone adds them to `STALE_PHRASES.json` (phrase, why, since; optional `allowIn`). Add one whenever a change makes an old sentence untrue. `docs/SPEC.md` and `docs/PROGRESS.md` are append-only records and are not checked.
- The commit summary in the changelog is refreshed by `docs:generate` but not compared by `docs:check`, because a commit cannot list itself.
- The MANIFEST check compares the whole branch against `origin/main`, so once a doc changed on the branch, later edits to its sources on the same branch are not flagged again.
