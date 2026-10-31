# Privacy

Your check is never stored. If you choose to contribute a case, we store structured facts and, only if you tick it, a redacted excerpt you reviewed, visible only to the moderator, deleted with your delete code or after 90 days.

ScamLens has no accounts and no login. This page lists everything it keeps, why, for how long, and how to remove it. The same promise is shown on the site at `/about#privacy` and `/privacy`.

## Data inventory

| What | When it is stored | What exactly | Purpose | Kept for | Who can see it |
|---|---|---|---|---|---|
| A check | never | the text is processed in memory only; nothing is written | answer the check | not stored | nobody |
| A report | you press Report with consent | per identifier: a keyed hash (HMAC with a server secret), a masked display (`+91 98******10`), the type; the scam category; a keyed hash of your network address (never the IP); the date | show "Reported by N independent people" once at least 2 different networks report the same identifier | 90 days | the site shows counts and the masked form only |
| A link between identifiers | from a report or case naming two or more identifiers | the two hashes and masked forms, a one-line evidence note, a short pseudonymous reporter key | the link graph and scam trail | 90 days (with the report) | counts and masked forms on the site |
| A contributed case | you press "Add it to the map" with consent | the reports above, plus category, channel, loss band, month (YYYY-MM), which patterns fired, and a keyed hash of your delete code | show how many others got the same message and what happened, as counts | 90 days | counts only on the site |
| A redacted excerpt | only if you tick the second box, after seeing the exact text | up to 500 characters with every identifier replaced by `[UPI]` `[PHONE]` `[WALLET]` `[HANDLE]` `[LINK]` `[EMAIL]` and every run of 4 or more digits by `[NUMBER]` | lets the moderator understand new scam patterns | 90 days, or until you delete it | the moderator only; no page, API, receipt, evidence pack or log returns it |
| A "Was this right?" answer | you choose scam, genuine or not sure | the verdict, fixed reason codes, which patterns fired, per identifier (keyed hash) and network (keyed hash); no free text | show "N reported, M marked genuine" next to Reported entries, as information only; it never changes a risk level | 90 days | counts only on the site |
| A contest | you contest an entry | the identifier's keyed hash and your reason (10 to 500 characters) | moderator review | until resolved, at most 90 days | the moderator only |
| Usage counters | every limited request | a hashed network key, the route and a daily count | daily limits against abuse | about 7 days | nobody on the site; the 7-day total of checks is shown on /about |
| Server logs | every request | an event name, a status and a duration | operations | Vercel's log retention | the owner |
| Your browser | first result in a tab | one session-storage flag for the one-time "New:" line | show that line once | until the tab closes | only your browser |

## Deleting

- **A case you contributed:** use the delete code shown once when you saved it, on `/privacy` ("Delete a case"). It removes the case and the excerpt at once. Tick "also remove my reports" to remove the reports and links written by the same contribution too.
- **Anything else** (a report you made, an entry about you, a contest): write to <!-- FACT:contact_email -->scamlenspvt@gmail.com<!-- /FACT --> (also in the site footer and on `/about#contact`). Requests are handled by hand in the database (`docs/MODERATION.md`). Never include passwords, OTPs or full card or account numbers in an email.

## What moderators can see

The moderator works in the Supabase SQL editor (`docs/MODERATION.md`). They can see hashes, masked displays, categories, channels, loss bands, months, pattern ids, contest reasons and redacted excerpts. They cannot see full identifiers (only hashes are stored), IP addresses, names, or the text of ordinary checks (never stored).

## Third parties

When you press Check, the identifiers in your text (not the text) are sent to the sources listed on `/about#sources`: GoPlus (wallet addresses and website domains), Etherscan and TronGrid (wallet addresses). The database is Supabase (Postgres) and the link graph is TigerGraph; both hold only the data above. AI is off.
