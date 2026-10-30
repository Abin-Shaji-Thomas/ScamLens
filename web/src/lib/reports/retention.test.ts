import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { localDb, MIGRATIONS_DIR } from "../../test-support/pglite";
import { extractIdentifiers } from "../identifiers";
import { CONTEST_RETENTION_DAYS } from "../limits";
import { fingerprintHash } from "./privacy";
import { contestIdentifier, reportedFor, reportsConfig, submitReport } from "./service";

// PGlite suite: each localDb() starts Postgres in WebAssembly (about 1 s alone, about 8 s when six start in parallel
// under vitest's workers), so the default 5 s limit was flaky. Explicit timeouts; no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

// Migration 003: contest reasons are kept only while a moderator needs them.
const PEPPER = "test-pepper-0123456789";
const UPI = "victim.pay@okdemo";
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "003_contest_retention.sql"), "utf8");
const MODERATION = readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "docs", "MODERATION.md"), "utf8");

const config = (db: Parameters<typeof reportsConfig>[1]) => {
  const c = reportsConfig({ REPORT_HASH_PEPPER: PEPPER }, db);
  if (typeof c === "string") throw new Error(c);
  return c;
};

async function setup() {
  const { db, pg } = await localDb();
  const cfg = config(db);
  for (const n of [1, 2]) await submitReport({ identifiers: [{ type: "upi", value: UPI }], category: "investment", consent: true }, fingerprintHash(PEPPER, `10.0.0.${n}`), cfg);
  await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID, please review" }, cfg);
  // Four more contest rows covering each case (raw SQL; the reason text is synthetic).
  await pg.exec(`
    insert into contests (identifier_hash, reason, status, created_at, decided_at) values
      ('h-old-pending', 'old pending reason text', 'pending', now() - interval '91 days', null),
      ('h-dismissed', 'dismissed reason text', 'dismissed', now() - interval '3 days', now() - interval '1 day'),
      ('h-upheld', 'upheld reason text', 'upheld', now() - interval '200 days', now() - interval '150 days'),
      ('h-fresh', 'fresh pending reason text', 'pending', now() - interval '89 days', null);`);
  return { db, pg, cfg };
}

describe("migration 003: purge_old_contests", () => {
  it("the SQL uses the same number of days as the code constant shown on /about", () => {
    expect(MIGRATION).toContain(`created_at < now() - interval '${CONTEST_RETENTION_DAYS} days'`);
  });

  it("deletes resolved contests and any older than 90 days; keeps recent pending ones", async () => {
    const { pg } = await setup();
    const { rows } = await pg.query<{ deleted: number }>("select * from purge_old_contests()");
    expect(rows[0].deleted).toBe(3);
    const left = (await pg.query<{ identifier_hash: string; status: string }>("select identifier_hash, status from contests order by id")).rows;
    expect(left.map((r) => r.status)).toEqual(["pending", "pending"]);
    expect(left.map((r) => r.identifier_hash)).toContain("h-fresh");
    expect(left.map((r) => r.identifier_hash)).not.toContain("h-old-pending");
  });

  it("never touches reports: the contested label and the counts stay as they were", async () => {
    const { pg, cfg } = await setup();
    const before = await reportedFor(extractIdentifiers(UPI), cfg);
    await pg.query("select * from purge_old_contests()");
    await pg.query("update contests set created_at = now() - interval '100 days'"); // age the real contest too
    await pg.query("select * from purge_old_contests()");
    const after = await reportedFor(extractIdentifiers(UPI), cfg);
    expect(after).toEqual(before);
    expect(after.entries[0]).toMatchObject({ reporters: 2, contested: true });
    expect((await pg.query("select count(*)::int as n from contests")).rows[0]).toEqual({ n: 0 });
  });

  it("is idempotent (the migration file runs twice) and a second purge deletes nothing", async () => {
    const { pg } = await setup();
    await pg.exec(MIGRATION);
    await pg.query("select * from purge_old_contests()");
    expect((await pg.query<{ deleted: number }>("select * from purge_old_contests()")).rows[0].deleted).toBe(0);
  });

  it("the app works without migration 003 (it never calls the function)", async () => {
    const { db, pg } = await localDb({ migrations: false });
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, "002_contest_policy.sql"), "utf8"));
    const cfg = config(db);
    for (const n of [1, 2]) await submitReport({ identifiers: [{ type: "upi", value: UPI }], category: "investment", consent: true }, fingerprintHash(PEPPER, `10.0.0.${n}`), cfg);
    expect(await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID, please review" }, cfg)).toEqual({ ok: true, updated: 2 });
    await expect(pg.query("select * from purge_old_contests()")).rejects.toThrow();
  });

  it("MODERATION.md section 5 runs the purge exactly as written", async () => {
    const { pg } = await setup();
    const sql = MODERATION.split("## 5. Housekeeping")[1]?.match(/```sql\n([\s\S]*?)```/)?.[1];
    expect(sql).toContain("purge_old_contests()");
    const { rows } = await pg.query<{ deleted: number }>(sql!);
    expect(rows[0].deleted).toBe(3);
  });
});
