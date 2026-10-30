import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDb } from "../test-support/pglite";
import type { Db } from "./reports/db";
import { resetUsageStatsCacheForTests, sumChecks, usageStats, usageStatsResponse, usageStatsSentence, windowStart } from "./usage-stats";
import { sqlUsageStore } from "./usage";

// PGlite suite: explicit timeouts (see usage.test.ts); no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const NOW = new Date("2026-10-30T12:00:00Z");
const row = (key: string, day: string, count: number) => ({ key, day, count });

beforeEach(() => resetUsageStatsCacheForTests());

describe("GET /api/usage-stats (H5)", () => {
  it("window is today and the 6 days before it (UTC)", () => {
    expect(windowStart(NOW)).toBe("2026-10-24");
  });

  it("sums only per-network check counters inside the window", () => {
    const rows = [
      row("fp:aa11:check", "2026-10-30", 5),
      row("fp:bb22:check", "2026-10-24", 2),
      row("fp:aa11:check", "2026-10-23", 100), // outside the window
      row("fp:aa11:graph", "2026-10-30", 50), // another route
      row("global:llm", "2026-10-30", 9), // the global LLM counter, not checks
      row("fp:aa11:check", "2026-10-31", 7), // a future day (clock skew) is not counted
    ];
    expect(sumChecks(rows, NOW)).toBe(7);
  });

  it("reads the real usage_counters table: counts what increment_usage recorded, denied calls excluded", async () => {
    const { db, pg } = await localDb();
    const store = sqlUsageStore(db);
    for (let i = 0; i < 3; i++) await store.consume("fp:0a1b:check", 2); // third call denied, not counted
    await store.consume("fp:2c3d:check", 10);
    await store.consume("fp:2c3d:graph", 10);
    await pg.query("insert into usage_counters (key, day, count) values ('fp:0a1b:check', (now() at time zone 'utc')::date - 9, 40)");
    const s = await usageStats({ db, now: () => new Date() });
    expect(s).toMatchObject({ checks: 3, days: 7 });
  });

  it("the response holds one number and no keys; 404 without a database or when the read fails", async () => {
    const { db } = await localDb();
    await sqlUsageStore(db).consume("fp:0a1b:check", 10);
    const ok = await usageStatsResponse({ db, now: () => new Date() });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
    const body = await ok.json();
    expect(Object.keys(body).sort()).toEqual(["asOf", "checks", "days"]);
    expect(JSON.stringify(body)).not.toContain("fp:");

    resetUsageStatsCacheForTests();
    expect((await usageStatsResponse({ db: null })).status).toBe(404);
    resetUsageStatsCacheForTests();
    const broken = { usageRowsSince: async () => { throw new Error("down"); } } as unknown as Db;
    const r = await usageStatsResponse({ db: broken });
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });

  it("caches for 5 minutes, so a busy /about costs at most one read per instance per 5 minutes", async () => {
    let reads = 0;
    const db = { usageRowsSince: async () => (reads++, [row("fp:aa:check", "2026-10-30", 4)]) } as unknown as Db;
    let t = NOW.getTime();
    const deps = { db, now: () => new Date(t) };
    expect((await usageStats(deps))?.checks).toBe(4);
    t += 4 * 60_000;
    await usageStats(deps);
    expect(reads).toBe(1);
    t += 2 * 60_000;
    await usageStats(deps);
    expect(reads).toBe(2);
  });

  it("the /about sentence, and the page places the line in the privacy section", () => {
    expect(usageStatsSentence({ checks: 1234, days: 7, asOf: NOW.toISOString() })).toBe(
      "Checks run in the last 7 days: 1,234 (includes our own testing). ScamLens does not track who runs them.",
    );
    const about = readFileSync(new URL("../app/about/page.tsx", import.meta.url), "utf8");
    const privacy = about.slice(about.indexOf('<Section id="privacy"'), about.indexOf('<Section id="graph"'));
    expect(privacy).toContain("<UsageStatsLine />");
    const route = readFileSync(new URL("../app/api/usage-stats/route.ts", import.meta.url), "utf8");
    expect(route).toContain("await connection();");
  });
});
