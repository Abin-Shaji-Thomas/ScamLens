# Architecture

ScamLens is one Next.js app on Vercel. Pages render on the server (the home page is a partial prerender: a static shell with the form streamed); API routes do the work. Supabase (Postgres) is the system of record; TigerGraph holds the link graph, with Postgres answering the same queries as a labelled fallback. Nothing in the browser holds a key.

## System context

```mermaid
flowchart LR
  U[Person in a browser] -->|HTTPS| V[Vercel: Next.js pages and API routes]
  V -->|service-role key| S[(Supabase Postgres)]
  V -->|graph-scoped token| G[(TigerGraph Savanna)]
  V -->|identifiers only| GP[GoPlus API]
  V -->|EVM wallets| ES[Etherscan V2]
  V -->|TRON wallets| TR[TronGrid]
  V -. bundled snapshots .-> L[OFAC and ScamSniffer lists in web/data]
  O[Owner] -->|SQL editor, scripts| S
  O -->|tg-setup.ts| G
```

## One check, step by step

```mermaid
sequenceDiagram
  participant B as Browser
  participant C as POST /api/check
  participant X as Extractor and rules
  participant V as Verified sources
  participant R as Reports (Postgres)
  participant T as Scam trail (TigerGraph or Postgres)
  B->>C: text (max 6,000 characters)
  C->>C: body cap, zod, daily limit per network
  C->>X: extract identifiers, run 18 rules on a de-obfuscated copy
  par in parallel
    C->>V: OFAC, ScamSniffer (local), GoPlus, Etherscan, TronGrid (5 s each)
    C->>R: reported_counts_v2 (2 independent reporters), feedback counts
    C->>T: Q4 neighbourhood for up to 5 identifiers, reported links, case counts (2.5 s deadline)
  end
  C->>C: risk rules, notices, signed receipt
  C-->>B: result (identifiers, tiers, risk, trail, coverage, receipt)
```

Typical times measured on 2026-10-30/31: rules-only parts in milliseconds; verified sources 0.2-1.5 s (Etherscan with rate limits can take several seconds for a first wallet); the scam trail 0.6-1.8 s against live TigerGraph. A check that hits a source's timeout shows that source as unavailable.

## Data model

```mermaid
erDiagram
  reports {
    text identifier_hash
    text identifier_display
    text reporter_fingerprint_hash
    text category
    uuid submission_id
    bool contested
    bool synthetic
  }
  graph_edges {
    text src_hash
    text dst_hash
    text relation
    text evidence
    uuid submission_id
    text reporter_key
  }
  cases {
    uuid case_id
    uuid submission_id
    text channel
    text loss_band
    text month
    text excerpt_redacted
    text delete_hash
  }
  feedback {
    text identifier_hash
    text reporter_fingerprint_hash
    text verdict
    text_array reasons
  }
  contests {
    text identifier_hash
    text reason
    text status
  }
  reports ||--o{ graph_edges : "same submission_id"
  reports ||--o| cases : "same submission_id"
  reports ||--o{ contests : "identifier_hash"
  reports ||--o{ feedback : "identifier_hash"
```

TigerGraph schema (`graph/schema.gsql`): vertices `Wallet`, `UPI`, `TelegramHandle`, `PhoneNumber`, `Domain` (each keyed by the identifier hash, with a masked display) and `Report` (keyed by submission id, with a pseudonymous reporter key); edges `MENTIONS` (report to identifier) and `PAID` (wallet to wallet). Tables, functions and migrations: [DATA-MODEL.md](DATA-MODEL.md).

## Deployment

```mermaid
flowchart TB
  GH[GitHub main] -->|push| VC[Vercel build]
  VC --> P[Production: scam-lens-two.vercel.app]
  P --- ENV[Environment variables in Vercel: Supabase, pepper, TigerGraph, Etherscan, receipt key]
  O[Owner] -->|migrations 002-004, by hand| SB[(Supabase)]
  O -->|resume workspace before demos| TG[(TigerGraph Savanna)]
```

## Failure behaviour

| What fails | What the person sees | What never happens |
|---|---|---|
| A verified source (timeout, error, bad answer) | that row says "unavailable" with the reason; "result is incomplete" | the source counted as "no match" |
| The reports database | "Reports database unavailable ... This is not a clean result." | "No known reports" |
| TigerGraph | the trail and the graph answer from Postgres, labelled "postgres (TigerGraph unavailable)" | silent switch |
| The trail deadline (2.5 s) | notice "The scam trail ... could not be checked this time" and the Link graph row "unavailable" | a lowered level |
| Migration 004 missing | "Contributing is not available right now."; trail counts come from reports | lost checks |
| Daily limit reached | HTTP 429 with Retry-After and a plain sentence | any external call |
| The receipt key missing | no receipt and no Share proof step | an unsigned "receipt" |
