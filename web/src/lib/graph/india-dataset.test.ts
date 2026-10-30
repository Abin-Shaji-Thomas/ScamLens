import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { localDb } from "../../test-support/pglite";
import { extractIdentifiers } from "../identifiers";
import { identifierHash } from "../reports/privacy";
import { canonicalIdentifier, reportedFor, type ReportsConfig } from "../reports/service";
import { findLinks } from "./index";
import { datasetKeys, datasetUuid, loadIndiaDataset, planCounts, removeIndiaSql, seedIndia } from "./india-dataset";
import { seedSynthetic } from "./seed";

// PGlite suite: explicit timeouts (see usage.test.ts); no assertion is relaxed.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const PEPPER = "test-pepper-0123456789";
const ds = loadIndiaDataset();
const env = { REPORT_HASH_PEPPER: PEPPER };
const h = (type: "upi" | "evm" | "telegram", v: string) => identifierHash(PEPPER, type, canonicalIdentifier(type, v)!.value);
const count = async (pg: { query: <T>(s: string) => Promise<{ rows: T[] }> }, sql: string) => (await pg.query<{ n: number }>(sql)).rows[0].n;

describe("Indian synthetic dataset (P4)", () => {
  it("is 56 cases in 10 campaigns with the brief's sizes, all synthetic identifiers", () => {
    expect(ds.cases).toHaveLength(56);
    const per = Object.fromEntries(Object.keys(ds.campaigns).map((k) => [k, ds.cases.filter((c) => String(c.campaign) === k).length]));
    expect(per).toEqual({ 1: 9, 2: 10, 3: 8, 4: 5, 5: 3, 6: 5, 7: 5, 8: 3, 9: 5, 10: 3 });
    expect(new Set(ds.cases.map((c) => c.id)).size).toBe(56);
    expect(new Set(ds.cases.map((c) => c.reporterIp)).size).toBe(56); // a distinct reporter per case
    for (const c of ds.cases) {
      expect(c.reporterIp).toMatch(/^(198\.51\.100|203\.0\.113)\.\d+$/); // documentation ranges only
      for (const i of c.identifiers) {
        expect(canonicalIdentifier(i.type, i.value), `${c.id} ${i.value}`).not.toBeNull();
        if (i.type === "upi") expect(i.value).toMatch(/^zzdemo\.[a-z0-9.]+@okdemo$/);
        if (i.type === "telegram") expect(i.value).toMatch(/^@zzdemo_/);
        if (i.type === "domain") expect(i.value).toMatch(/\.example\.(com|net|org)$/);
      }
      expect(c.month).toMatch(/^2026-(0[5-9]|10)$/);
    }
    const wallets = new Set((JSON.parse(readFileSync(new URL("../../../../eval/synthetic-wallets.json", import.meta.url), "utf8")) as { evm: string[]; tron: string[] }).evm.concat([]));
    for (const c of ds.cases) for (const i of c.identifiers) if (i.type === "evm") expect(wallets.has(i.value), i.value).toBe(true);
    // shared wallet across campaigns 2 and 3; one admin handle across 2 and 9
    const campaignsOf = (v: string) => new Set(ds.cases.filter((c) => c.identifiers.some((i) => i.value === v)).map((c) => c.campaign));
    expect([...campaignsOf(ds.payments[2][0])].sort()).toEqual([2, 3]);
    expect([...campaignsOf("@zzdemo_hr_admin")].sort()).toEqual([2, 9]);
    expect(planCounts(ds)).toMatchObject({ cases: 56, payments: 5, flagged: 1, exchanges: 1, contested: 2 });
  });

  it("seeds through the real path: Q1, Q2, Q3 each non-empty for 2+ cases, the exchange is excluded, contested entries labelled", async () => {
    const { db, pg } = await localDb();
    const cfg: ReportsConfig = { db, pepper: PEPPER, maxPerDay: 5 };
    const counts = await seedIndia(cfg, ds);
    expect(counts).toMatchObject({ cases: 56, caseRows: 56, migration004: true, contested: 2 });
    expect(await count(pg, "select count(*)::int n from cases where synthetic")).toBe(56);
    expect(await count(pg, "select count(*)::int n from reports where not synthetic")).toBe(0);
    const deps = { env, db };
    const q1 = await Promise.all(["zzdemo.lovely.trades@okdemo", "zzdemo.fx.signals@okdemo", "zzdemo.taskpay@okdemo"].map((u) => findLinks({ kind: "q1", upiHash: h("upi", u) }, deps)));
    expect(q1.filter((r) => r.length > 0).length).toBeGreaterThanOrEqual(2);
    const q2 = await Promise.all([ds.payments[0][0], ds.payments[2][0], ds.payments[3][0]].map((w) => findLinks({ kind: "q2", walletHash: h("evm", w) }, deps)));
    expect(q2[0].length).toBeGreaterThan(0); // 2 hops via the mule
    expect(q2[1].length).toBeGreaterThan(0); // 1 hop
    expect(q2[2]).toEqual([]); // the only path runs through the exchange-style address
    const q3 = await findLinks({ kind: "q3", minSize: 2 }, deps);
    expect(q3.length).toBeGreaterThanOrEqual(2);
    const ex = h("evm", ds.exchanges[0]);
    for (const r of q1.flat()) expect(r.wallet_hash).not.toBe(ex);
    for (const r of q3) expect(r.wallet_hash).not.toBe(ex);
    for (const r of q2.flat()) expect(r.path).not.toContain(ex);
    const shop = await reportedFor(extractIdentifiers("zzdemo.kirana.shop@okdemo"), cfg);
    expect(shop.entries[0]).toMatchObject({ reporters: 2, contested: true, synthetic: true });
    const [trail] = await db.call<{ cases: number; synthetic_cases: number; real_cases: number }>("case_trail_summary", { p_hashes: [h("upi", "zzdemo.cbi.verify@okdemo")] });
    expect(trail).toMatchObject({ cases: 5, synthetic_cases: 5, real_cases: 0 });
  });

  it("is idempotent: a second run leaves the same row counts and adds no second contest", async () => {
    const { db, pg } = await localDb();
    const cfg: ReportsConfig = { db, pepper: PEPPER, maxPerDay: 5 };
    await seedIndia(cfg, ds);
    const snap = async () => Promise.all(["reports", "graph_edges", "cases", "contests", "flagged_addresses", "exchange_addresses"].map((t) => count(pg, `select count(*)::int n from ${t}`)));
    const first = await snap();
    await seedIndia(cfg, ds);
    expect(await snap()).toEqual(first);
  });

  it("before migration 004 it still seeds reports and links (no case rows)", async () => {
    const { db, pg } = await localDb({ migrations: false });
    const counts = await seedIndia({ db, pepper: PEPPER, maxPerDay: 5 }, { ...ds, contested: [] });
    expect(counts).toMatchObject({ migration004: false, caseRows: 0 });
    expect(await count(pg, "select count(distinct submission_id)::int n from reports")).toBe(56);
  });

  it("--remove deletes only this dataset's rows and leaves other demo data alone", async () => {
    const { db, pg } = await localDb();
    const cfg: ReportsConfig = { db, pepper: PEPPER, maxPerDay: 5 };
    await seedSynthetic(cfg);
    const before = await Promise.all(["reports", "graph_edges", "flagged_addresses", "exchange_addresses"].map((t) => count(pg, `select count(*)::int n from ${t}`)));
    await seedIndia(cfg, ds);
    await removeIndiaSql(pg, PEPPER, ds);
    const after = await Promise.all(["reports", "graph_edges", "flagged_addresses", "exchange_addresses"].map((t) => count(pg, `select count(*)::int n from ${t}`)));
    expect(after).toEqual(before);
    expect(await count(pg, "select count(*)::int n from cases")).toBe(0);
    expect(await count(pg, "select count(*)::int n from contests")).toBe(0);
    const { submissions } = datasetKeys(PEPPER, ds);
    expect(submissions[0]).toBe(datasetUuid(ds.cases[0].id));
  });
});
