import { generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { localDb } from "../../test-support/pglite";
import { runCheck, type RunDeps } from "../check";
import { buildCoverage } from "../coverage";
import { loadIndiaDataset, seedIndia } from "../graph/india-dataset";
import type { GraphBackend } from "../graph/types";
import { extractIdentifiers } from "../identifiers";
import type { Db } from "../reports/db";
import { fingerprintHash } from "../reports/privacy";
import { submitReport } from "../reports/service";
import { Receipt } from "../receipt-format";
import { receiptFor, verifyReceipt } from "../receipts";
import { pickTrailIdentifiers, resetTrailCacheForTests, runScamTrail } from "./trail";
import { TRAIL_UNAVAILABLE_NOTICE } from "./schema";

// PGlite suite: explicit timeouts (see usage.test.ts); no assertion is relaxed.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 90_000 });

const PEPPER = "test-pepper-0123456789";
const env = { REPORT_HASH_PEPPER: PEPPER };
let db: Db;
const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
  fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch,
  timeoutMs: 20,
  now: () => new Date("2026-10-30T10:00:00Z"),
  env,
  db,
  ...over,
});
const never: GraphBackend = { name: "tigergraph", run: () => new Promise(() => {}) };
const broken: GraphBackend = { name: "tigergraph", run: () => Promise.reject(new Error("tigergraph down")) };

beforeAll(async () => {
  resetTrailCacheForTests();
  ({ db } = await localDb());
  await seedIndia({ db, pepper: PEPPER, maxPerDay: 5 }, loadIndiaDataset());
  // One more network reports a new UPI ID together with a campaign-1 UPI ID that 5 networks reported (now 6).
  await submitReport(
    { identifiers: [{ type: "upi", value: "zzdemo.newlink@okdemo" }, { type: "upi", value: "zzdemo.cbi.verify@okdemo" }], category: "digital_arrest", consent: true },
    fingerprintHash(PEPPER, "203.0.113.200"),
    { db, pepper: PEPPER, maxPerDay: 5 },
    true,
  );
});

describe("scam trail in the check (P5)", () => {
  it("picks wallets first, then other graph types, at most 5", () => {
    const ids = extractIdentifiers("a@okdemo b.c@okdemo @zzdemo_one1 @zzdemo_two2 zzdemo.x@okdemo 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359 TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL");
    const picked = pickTrailIdentifiers(ids);
    expect(picked).toHaveLength(5);
    expect(picked.slice(0, 2).map((i) => i.type)).toEqual(["evm", "tron"]);
  });

  it("with links: counts linked identifiers, reported links, case counts apart for demo data, backend and ms", async () => {
    const r = await runCheck({ text: "Pay the task fee to zzdemo.taskpay@okdemo" }, deps());
    expect(r.trail).toMatchObject({ status: "ok", backend: "postgres" });
    expect(r.trail!.elapsedMs).toBeGreaterThanOrEqual(0);
    const [e] = r.trail!.entries;
    expect(e).toMatchObject({ type: "upi", display: expect.stringMatching(/okdemo$/) });
    expect(e.linked).toBeGreaterThan(0);
    expect(e.reportedLinks).toBeGreaterThan(0);
    expect(r.trail!.summary).toMatchObject({ source: "cases", realCases: 0 });
    expect(r.trail!.summary!.syntheticCases).toBeGreaterThan(0);
    expect(r.trail!.summary!.channels.length).toBeGreaterThan(0);
    expect(JSON.stringify(r.trail)).not.toContain("zzdemo.taskpay"); // masked only
    const row = buildCoverage(r, { graph: null }).rows.find((x) => x.id === "graph")!;
    expect(row.status).toBe("checked");
    expect(row.when).toMatch(/^postgres, \d+ ms$/);
  });

  it("no links: an unseen identifier has an entry with 0 links and the level is unchanged", async () => {
    const r = await runCheck({ text: "Meeting moved, pay zzdemo.nobody@okdemo later" }, deps());
    expect(r.trail!.entries).toEqual([expect.objectContaining({ linked: 0, reportedLinks: 0, maxLinkedReporters: 0 })]);
    expect(r.risk.level).toBe("low");
  });

  it("lifts Low to Elevated when a linked identifier has 2+ independent reporters, with the reason; never High", async () => {
    const text = "pay zzdemo.newlink@okdemo";
    const r = await runCheck({ text }, deps());
    expect(r.reported.entries).toEqual([]); // the identifier itself has one reporter
    expect(r.risk.level).toBe("elevated");
    expect(r.risk.reasons).toContain("Linked to an identifier reported by 6 independent people"); // 5 dataset networks + this one
    const off = await runCheck({ text }, deps({ trail: false }));
    expect(off.risk.level).toBe("low");
    const withPatterns = await runCheck({ text: `Urgent: you are under digital arrest, ${text} within 1 hour` }, deps());
    expect(withPatterns.risk.level).toBe("elevated"); // patterns + trail, but no verified fact or own reports: not High
  });

  it("timeout: unavailable with a notice, never clean, and the Link graph row says so", async () => {
    const r = await runCheck({ text: "pay zzdemo.newlink@okdemo" }, deps({ trail: { backend: never, timeoutMs: 50 } }));
    expect(r.trail).toMatchObject({ status: "unavailable", reason: "timed out", entries: [] });
    expect(r.notices).toContain(TRAIL_UNAVAILABLE_NOTICE);
    expect(r.risk.level).toBe("low"); // no lift without the trail, and nothing claims the identifier is clean
    const row = buildCoverage(r, { graph: null }).rows.find((x) => x.id === "graph")!;
    expect(row).toMatchObject({ status: "unavailable" });
    expect(row.detail).toContain("timed out");
  });

  it("TigerGraph down: answers from Postgres, labelled", async () => {
    const t = await runScamTrail(extractIdentifiers("zzdemo.taskpay@okdemo"), { env, db, backend: broken });
    expect(t).toMatchObject({ status: "ok", backend: "postgres (TigerGraph unavailable)" });
    expect(t.entries[0].linked).toBeGreaterThan(0);
  });

  it("off without a graph database (local runs): no entries, no notice", async () => {
    const r = await runCheck({ text: "pay zzdemo.newlink@okdemo" }, deps({ db: null }));
    expect(r.trail).toEqual({ status: "off", entries: [] });
    expect(r.notices).not.toContain(TRAIL_UNAVAILABLE_NOTICE);
  });

  it("receipts: the new graph row is signed; a receipt without it (issued before) still verifies", async () => {
    const keyEnv = { RECEIPT_SIGNING_KEY: generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") };
    const r = await runCheck({ text: "pay zzdemo.taskpay@okdemo" }, deps());
    const receipt = receiptFor(r, "pay zzdemo.taskpay@okdemo", keyEnv, "abc1234")!;
    expect(receipt.graph).toMatchObject({ status: "checked", when: expect.stringMatching(/^postgres, \d+ ms$/) });
    expect(verifyReceipt(Receipt.parse(JSON.parse(JSON.stringify(receipt))), keyEnv).valid).toBe(true);
    expect(verifyReceipt({ ...receipt, graph: { status: "unavailable", when: "" } }, keyEnv).valid).toBe(false); // signed
    const old = receiptFor({ ...r, trail: undefined }, "pay zzdemo.taskpay@okdemo", keyEnv, "abc1234")!;
    expect("graph" in old && old.graph !== undefined).toBe(false);
    expect(verifyReceipt(Receipt.parse(JSON.parse(JSON.stringify(old))), keyEnv).valid).toBe(true);
  });
});

describe("Scam trail section on the result (P5)", () => {
  it("renders sentences, case counts marked as demo data, the not-proof note and the backend; absent without links", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { RiskCard } = await import("../../components/RiskCard");
    const { DEMO_LABEL } = await import("../demo");
    const r = await runCheck({ text: "Pay the task fee to zzdemo.taskpay@okdemo" }, deps());
    const html = renderToStaticMarkup(createElement(RiskCard, { result: r }));
    const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    expect(html).toContain("data-trail");
    expect(text).toContain("Scam trail");
    expect(text).toMatch(/This UPI ID \(zz\S*okdemo\) is linked to \d+ other identifier\(s\); \d+ of them reported by 2 or more independent people/);
    expect(text).toContain("How many others got this and what happened");
    expect(text).toMatch(/\d+ linked case\(s\) from \d+ independent people, all illustrative demo data\./);
    expect(text).toContain("A link is not proof of wrongdoing.");
    expect(text).toContain(DEMO_LABEL);
    expect(text).toMatch(/Checked with postgres in \d+ ms/);
    expect(text).not.toMatch(/\b(scammer|fraudster|criminal|guilty|confirmed scam)\b/i);
    const none = await runCheck({ text: "pay zzdemo.nobody@okdemo later" }, deps());
    expect(renderToStaticMarkup(createElement(RiskCard, { result: none }))).not.toContain("data-trail");
  });
});
