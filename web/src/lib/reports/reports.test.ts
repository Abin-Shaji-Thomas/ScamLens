import { beforeEach, describe, expect, it } from "vitest";
import { localDb } from "../../test-support/pglite";
import { findLinks } from "../graph";
import { postgresBackend } from "../graph/postgres";
import { refQ1, refQ2, refQ3 } from "../graph/reference";
import { seedSynthetic, SEED_IDS, type Scenario } from "../graph/seed";
import { buildGraphView } from "../graph/view";
import { extractIdentifiers } from "../identifiers";
import type { Db } from "./db";
import { fingerprintHash, maskIdentifier } from "./privacy";
import type { ReportRequest } from "./schema";
import { contestIdentifier, reportedFor, reportsConfig, submitReport, type ReportsConfig } from "./service";

const PEPPER = "test-pepper-0123456789";
const UPI = "victim.pay@okdemo";
const req = (value = UPI): ReportRequest => ({ identifiers: [{ type: "upi", value }], category: "investment", consent: true });
const fp = (n: number) => fingerprintHash(PEPPER, `10.0.0.${n}`, "test-agent");

let cfg: ReportsConfig;
let db: Db;
let pg: Awaited<ReturnType<typeof localDb>>["pg"];

beforeEach(async () => {
  ({ db, pg } = await localDb());
  const c = reportsConfig({ REPORT_HASH_PEPPER: PEPPER }, db);
  if (typeof c === "string") throw new Error(c);
  cfg = c;
});

const reported = () => reportedFor(extractIdentifiers(UPI), cfg);

describe("2-reporter rule", () => {
  it("one reporter is not shown publicly", async () => {
    await submitReport(req(), fp(1), cfg);
    expect(await reported()).toEqual({ status: "ok", entries: [] });
  });
  it("the same fingerprint reporting twice still counts once", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(1), cfg);
    expect((await reported()).entries).toEqual([]);
  });
  it("two distinct fingerprints produce a masked Reported entry", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    const r = await reported();
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({ type: "upi", display: maskIdentifier("upi", UPI), reporters: 2, synthetic: false });
    expect(r.entries[0].display).not.toContain("victim.pay");
  });
  it("contested entries are hidden", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    expect(await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID" }, cfg)).toEqual({ ok: true, updated: 2 });
    expect((await reported()).entries).toEqual([]);
  });
  it("reports older than 90 days / expired do not count", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    await pg.query("update reports set created_at = now() - interval '91 days', expires_at = now() - interval '1 day'");
    expect((await reported()).entries).toEqual([]);
  });
  it("stores only hashes and masked text, never the raw identifier", async () => {
    await submitReport(req(), fp(1), cfg);
    const dump = JSON.stringify((await pg.query("select * from reports")).rows);
    expect(dump).not.toContain("victim.pay");
  });
  it("rate-limits a fingerprint per day", async () => {
    const small = { ...cfg, maxPerDay: 2 };
    expect((await submitReport(req("a1.x@okdemo"), fp(1), small)).ok).toBe(true);
    expect((await submitReport(req("a2.x@okdemo"), fp(1), small)).ok).toBe(true);
    expect(await submitReport(req("a3.x@okdemo"), fp(1), small)).toEqual({ ok: false, reason: "rate_limited" });
  });
  it("rejects identifiers that fail the extractor", async () => {
    const r = await submitReport({ identifiers: [{ type: "evm", value: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD" }], category: "other", consent: true }, fp(1), cfg);
    expect(r).toEqual({ ok: false, reason: "invalid evm identifier" });
  });
  it("an empty REPORTS_MAX_PER_DAY= line in .env falls back to the default, not 0", async () => {
    const c = reportsConfig({ REPORT_HASH_PEPPER: PEPPER, REPORTS_MAX_PER_DAY: "" }, db);
    if (typeof c === "string") throw new Error(c);
    expect(c.maxPerDay).toBe(5);
    expect((await submitReport(req(), fp(1), c)).ok).toBe(true);
  });
  it("missing DB or pepper -> unavailable, not 'no reports'", async () => {
    expect(await reportedFor(extractIdentifiers(UPI), reportsConfig({}, null))).toMatchObject({ status: "unavailable" });
    expect(reportsConfig({ REPORT_HASH_PEPPER: "short" }, db)).toBe("REPORT_HASH_PEPPER not configured");
  });
});

describe("graph on synthetic seed (Postgres fallback vs independent reference)", () => {
  let s: Scenario;
  beforeEach(async () => {
    s = await seedSynthetic(cfg);
  });
  const deps = (hub = "25") => ({ env: { GRAPH_HUB_MAX: hub }, db });

  it("Q1: UPI -> wallet -> Telegram only through a shared wallet", async () => {
    const rows = await findLinks({ kind: "q1", upiHash: s.nodes.u1.hash }, deps());
    const got = rows.map((r) => `${r.wallet} -> ${r.telegram}`).sort();
    // t1 is excluded: it was also reported directly with the UPI, so it is not linked "only through the wallet".
    expect(got).toEqual([`${s.nodes.main.display} -> ${s.nodes.t2.display}`, `${s.nodes.main.display} -> ${s.nodes.t3.display}`].sort());
    expect(got).toEqual(refQ1(s, s.nodes.u1.hash, 25));
  });
  it("hub filter: an exchange wallet does not link unrelated people (Q1 via exchange is empty)", async () => {
    expect(await findLinks({ kind: "q1", upiHash: s.nodes.u2.hash }, deps())).toEqual([]);
    expect(refQ1(s, s.nodes.u2.hash, 25)).toEqual([]);
  });
  it("hub filter: a wallet above N counterparties stops linking (N configurable)", async () => {
    expect(await findLinks({ kind: "q1", upiHash: s.nodes.u1.hash }, deps("3"))).toEqual([]);
    expect(refQ1(s, s.nodes.u1.hash, 3)).toEqual([]);
  });
  it("Q2: two payment hops to a flagged address, never through an exchange", async () => {
    const rows = await findLinks({ kind: "q2", walletHash: s.nodes.w2.hash }, deps());
    const got = rows.map((r) => r.path_display.join(" -> ")).sort();
    expect(got).toEqual([[s.nodes.w2, s.nodes.w3, s.nodes.f1].map((n) => n.display).join(" -> ")]);
    expect(got).toEqual(refQ2(s, s.nodes.w2.hash, 25));
  });
  it("Q3: Telegram handles paying into the same wallet, with cluster size", async () => {
    const rows = await findLinks({ kind: "q3", minSize: 2 }, deps());
    expect(rows.map((r) => `${r.wallet}: ${r.cluster_size} handles`).sort()).toEqual(refQ3(s, 2, 25));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ wallet: s.nodes.main.display, cluster_size: 3 });
  });
  it("Q4: neighbourhood edges exist and the seed is flagged synthetic", async () => {
    const edges = await postgresBackend(db).run({ kind: "q4", hash: s.nodes.main.hash, depth: 1, idType: "evm" }, 25);
    // main's 4 co-report edges + the u1-t1 edge between two of its neighbours.
    expect(edges.length).toBe(5);
    const { rows } = await pg.query<{ n: number }>("select count(*)::int n from reports where not synthetic");
    expect(rows[0].n).toBe(0);
  });
  it("graph view: UPI gets Q1 path text with evidence; node ids are hash prefixes, not identifiers", async () => {
    const v = await buildGraphView({ type: "upi", value: SEED_IDS.u1 }, { REPORT_HASH_PEPPER: PEPPER }, db);
    expect(v.status).toBe("ok");
    expect(v.paths.filter((p) => p.query === "Q1")).toHaveLength(2);
    expect(v.paths[0].text).toMatch(/linked to Telegram .* only through shared wallet/);
    expect(JSON.stringify(v)).not.toContain(SEED_IDS.u1);
  });
  it("graph view: wallet gets Q2 and Q3 paths", async () => {
    const main = await buildGraphView({ type: "evm", value: SEED_IDS.main }, { REPORT_HASH_PEPPER: PEPPER }, db);
    expect(main.paths.map((p) => p.query)).toEqual(["Q3"]);
    const w2 = await buildGraphView({ type: "evm", value: SEED_IDS.w2 }, { REPORT_HASH_PEPPER: PEPPER }, db);
    expect(w2.paths.map((p) => p.query)).toEqual(["Q2"]);
  });
  it("graph view without a database is 'unavailable'", async () => {
    expect((await buildGraphView({ type: "upi", value: SEED_IDS.u1 }, {}, null)).status).toBe("unavailable");
  });

  it("seeded UPI u1 shows as Reported (3 reporters), marked synthetic", async () => {
    const r = await reportedFor(extractIdentifiers(SEED_IDS.u1), cfg);
    expect(r.entries[0]).toMatchObject({ reporters: 3, synthetic: true });
  });
});
