# Security policy

## Reporting a vulnerability

1. **First choice:** GitHub private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). Only the maintainer can read it.
2. **Alternative:** email <!-- FACT:contact_email -->scamlenspvt@gmail.com<!-- /FACT --> with "Security" in the subject.

Please include what you found, how to reproduce it and what it affects. **Never include user data** (chats, identifiers, receipts, delete codes) or any password, OTP, key or token in a report or an email; describe the class of problem instead. Do not test against other people's data, and keep load on the live site small (the daily limits apply to you too).

There is no bug bounty, and no response time is promised; reports are read and fixed by hand.

## What is in scope

- The web app and its API routes (`web/src/app`), including the limits, headers and receipts.
- The database functions in `web/db` and the TigerGraph queries in `graph/`.
- The data handling described in [docs/PRIVACY.md](docs/PRIVACY.md).

## How the project protects itself

Strict browser security headers, input size caps, daily per-network limits, no secrets in the browser, hashed identifiers and reporter fingerprints, no stored chats, and service-role-only database access. Details: [docs/knowledge/10-SECURITY-AND-ABUSE.md](docs/knowledge/10-SECURITY-AND-ABUSE.md).
