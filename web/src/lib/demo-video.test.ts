import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { localDb } from "../test-support/pglite";
import { runCheck, type RunDeps } from "./check";
import { buildCoverage } from "./coverage";
import { DEMO_VIDEO_PATH, loadDemoVideoDataset, seedIndia } from "./graph/india-dataset";

// PGlite suite: explicit timeouts (see usage.test.ts); no assertion is relaxed.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const SMS_PATH = join(import.meta.dirname, "..", "..", "..", "docs", "demo", "video-sms.txt");
const PEPPER = "test-pepper-0123456789";
const seeded = existsSync(SMS_PATH) && existsSync(DEMO_VIDEO_PATH);
const offline = (db: RunDeps["db"]): RunDeps => ({
  fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch,
  timeoutMs: 20,
  now: () => new Date("2026-10-31T10:00:00Z"),
  env: { REPORT_HASH_PEPPER: PEPPER },
  db,
});

describe.skipIf(!seeded)("demo video SMS (docs/demo/video-sms.txt)", () => {
  const text = seeded ? readFileSync(SMS_PATH, "utf8") : "";

  it("is stored byte for byte with LF endings and has the two demo identifiers", () => {
    expect(text.includes("\r")).toBe(false);
    expect(text.startsWith("ALERT: Your bank account has been HACKED.")).toBe(true);
    const ds = loadDemoVideoDataset();
    expect(ds.cases).toHaveLength(4);
    expect(new Set(ds.cases.map((c) => c.reporterIp)).size).toBe(4);
    for (const c of ds.cases) {
      expect(c.reporterIp).toMatch(/^203\.0\.113\.\d+$/);
      expect(c).toMatchObject({ category: "account_hacked", channel: "sms", lossBand: "10k_1l" });
      expect(c.identifiers.map((i) => i.value)).toEqual(["secure.helpdesk35@okdemo", "0x928c3dC199f45304d8145aed7a6Db53e6b158304"]);
    }
  });

  it("is High against the seeded demo data, only through reports + a counted pattern; Elevated without the reports", async () => {
    const before = await runCheck({ text }, offline(null));
    expect(before.identifiers.map((i) => [i.type, i.check])).toEqual([["upi", "format"], ["evm", "checksum"]]);
    const counted = [...new Set(before.suspected.filter((s) => s.context !== "warning").map((s) => s.rule_id))].sort();
    expect(counted).toEqual(["account_hacked_deposit", "urgency_deadline"]);
    expect(before.risk.level).toBe("elevated"); // patterns alone never reach High

    const { db } = await localDb();
    const written = await seedIndia({ db, pepper: PEPPER, maxPerDay: 5 }, loadDemoVideoDataset());
    expect(written).toMatchObject({ cases: 4, reports: 8 });
    const r = await runCheck({ text }, offline(db));
    expect(r.risk.level).toBe("high");
    expect(r.reported.entries).toHaveLength(2);
    for (const e of r.reported.entries) expect(e).toMatchObject({ reporters: 4, contested: false, synthetic: true, categories: ["account_hacked"] });
    expect(r.risk.reasons).toEqual(expect.arrayContaining(["2 identifier(s) reported by 2+ independent people", "2 suspected pattern(s) in the text"]));
    expect(r.risk.reasons.join(" ")).not.toMatch(/verified match/); // not from a verified list
    // The scam trail links the two identifiers to each other; it is not what makes the level High.
    expect(r.trail?.status).toBe("ok");
    expect(r.trail!.entries.every((e) => e.linked >= 1 && e.reportedLinks >= 1)).toBe(true);
    const noTrail = await runCheck({ text }, { ...offline(db), trail: false });
    expect(noTrail.risk.level).toBe("high");
  });

  it("the ledger lists every wallet source for the wallet (checked or unavailable, never not applicable)", async () => {
    const r = await runCheck({ text }, offline(null));
    const rows = buildCoverage(r, { graph: null }).rows;
    for (const id of ["ofac", "scamsniffer", "goplus", "etherscan"]) {
      const row = rows.find((x) => x.id === id)!;
      expect(["checked", "unavailable", "skipped (limit)"], id).toContain(row.status);
    }
    expect(rows.find((x) => x.id === "trongrid")!.status).toBe("not applicable"); // no TRON address in the SMS
  });
});
