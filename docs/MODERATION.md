# Moderating contested reports

**Policy (since round 2, G2).** When someone contests a Reported entry, nothing is hidden. The entry stays visible on the card, labelled **"Contested, under review"**, and from then on it counts only as a weak signal: it can raise a result to *Elevated* but never to *High*. Only you, the moderator, decide what happens next:

- **Uphold** the contest (the reports were wrong): the reports for that identifier are deleted. The entry disappears.
- **Dismiss** the contest (the reports stand): the label is cleared and the entry counts normally again.

Contest reasons are 10 to 500 characters, stored only in the `contests` table, never returned by any API and never shown on the site. Read them here, in the Supabase SQL editor, which shows them as plain text. Each network can file at most 3 contests per day (`USAGE_CONTEST_PER_DAY`).

Prerequisite: migration `web/db/migrations/002_contest_policy.sql` has been run once (HUMAN_TASKS 1). Until it is, the site keeps the old behaviour for existing contested rows (hidden) and refuses new contests with "Contesting is not available right now", so no new evidence can be hidden.

All statements below run in **Supabase -> SQL Editor -> New query**. They were exercised against the same schema in the test suite (`web/src/lib/reports/reports.test.ts`, "dismissing a contest ... upholding removes the reports").

## 1. List pending contests

```sql
select c.id as contest_id,
       c.created_at,
       min(r.identifier_type)    as type,
       min(r.identifier_display) as shown_as,          -- masked, e.g. zz***d@okdemo
       count(distinct r.reporter_fingerprint_hash) as independent_reporters,
       array_agg(distinct r.category) as categories,
       bool_or(r.synthetic)      as demo_data,
       c.reason
from contests c
left join reports r on r.identifier_hash = c.identifier_hash
where c.status = 'pending'
group by c.id, c.created_at, c.reason
order by c.created_at;
```

Look at the reason, the number of independent reporters and the categories. You cannot see the full identifier (only the masked form) because ScamLens never stores it; if the contester gave proof in the reason (for example "this is my shop's UPI ID"), weigh that against the number of independent reporters.

## 2a. Dismiss a contest (keep the reports)

Replace `123` with the `contest_id` from step 1.

```sql
with c as (
  update contests set status = 'dismissed', decided_at = now()
  where id = 123 and status = 'pending'
  returning identifier_hash
)
update reports set contested = false
where identifier_hash in (select identifier_hash from c)
  and not exists (select 1 from contests p
                  where p.identifier_hash = reports.identifier_hash and p.status = 'pending' and p.id <> 123);
```

The label stays if another contest for the same identifier is still pending.

## 2b. Uphold a contest (remove the reports)

```sql
with c as (
  update contests set status = 'upheld', decided_at = now()
  where id = 123 and status = 'pending'
  returning identifier_hash
),
e as (
  delete from graph_edges
  where src_hash in (select identifier_hash from c) or dst_hash in (select identifier_hash from c)
)
delete from reports where identifier_hash in (select identifier_hash from c);
```

This deletes every report naming that identifier and its links in the Postgres graph. Note the hash first if you also need to clean TigerGraph (step 4):

```sql
select identifier_hash from contests where id = 123;
```

## 3. Remove a report without a contest

For example, when a report clearly targets the wrong person or contains a mistake you spotted yourself. Find it by its masked display:

```sql
select identifier_hash, identifier_type, identifier_display, count(*) as reports, max(created_at) as last
from reports
where identifier_display = 'zz***d@okdemo'      -- the masked text shown on the card
group by 1, 2, 3;
```

Then, with the hash from that result:

```sql
delete from graph_edges where src_hash = '<hash>' or dst_hash = '<hash>';
delete from reports where identifier_hash = '<hash>';
```

## 4. TigerGraph after removing reports

TigerGraph holds a copy of the links, and `scripts/tg-setup.ts --load` only adds data; it never deletes. After an uphold or removal, the graph view can keep showing the old links while it runs on TigerGraph, and `npx tsx scripts/tg-setup.ts --check` will report a parity difference. To remove the vertex, use TigerGraph's REST API with the hash from step 2b or 3. The vertex type is `UPI`, `Wallet`, `TelegramHandle`, `PhoneNumber` or `Domain`, matching the identifier type. This call was **not** run during development (UNKNOWN), so check the TigerGraph docs for your workspace version first:

```text
DELETE https://<TG_HOST>/restpp/graph/<TG_GRAPH>/vertices/<VertexType>/<hash>
Authorization: Bearer <token for TG_SECRET>
```

Then run `npx tsx scripts/tg-setup.ts --check` and expect `N/N queries SAME`.

## 4b. Contributed cases and feedback (migration 004)
Requests (deletion, corrections, contests) arrive by email at the project address in `web/src/lib/contact.ts`.

List recent cases (no excerpt):
```sql
select case_id, category, channel, loss_band, month, rule_ids, synthetic, created_at, expires_at, excerpt_redacted is not null as has_excerpt
from cases order by created_at desc limit 50;
```
Read one excerpt (redacted text, moderator only): `select excerpt_redacted from cases where case_id = '<id>';`

Remove a case on request (when the person lost the delete code), keeping its reports:
```sql
delete from cases where case_id = '<id>';
```
To remove its reports and links as well, first note its `submission_id`, then `delete from graph_edges where submission_id = '<sub>'; delete from reports where submission_id = '<sub>';` and follow section 4 for TigerGraph.

Read feedback for one identifier hash: `select verdict, reasons, rule_ids, created_at from feedback where identifier_hash = '<hash>';` (one row per network; no free text).

## 5. Housekeeping (monthly)
Run `select * from purge_expired_cases();` (expired cases, excerpts whose reports are gone, feedback older than 90 days) after migration 004.

Contest reasons are kept only while you need them. After migration `web/db/migrations/003_contest_retention.sql` has been run once, run this on the first day of each month:

```sql
select * from purge_old_contests();
```

It deletes every contest that is already decided (upheld or dismissed) and every contest older than 90 days, and returns how many rows it deleted. It never changes reports: if an old pending contest is purged, its "Contested, under review" label stays until you clear it (section 2a) or the reports expire. Decide pending contests within 90 days so nothing is lost.
