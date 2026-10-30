import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { runCheck } from "../check";

// PGlite suite: each localDb() starts Postgres in WebAssembly (about 1 s alone, about 8 s when six start in parallel
// under vitest's workers), so the default 5 s limit was flaky. Explicit timeouts; no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const PEPPER = "test-pepper-0123456789";
const UPI = "victim.pay@okdemo";
const req = (value = UPI): ReportRequest => ({ identifiers: [{ type: "upi", value }], category: "investment", consent: true });
const fp = (n: number) => fingerprintHash(PEPPER, `10.0.0.${n}`);

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
    expect(await reported()).toEqual({ status: "ok", entries: [], contestPolicy: "visible" });
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
  // G2 replaced the old policy ("contested entries are hidden"), which let anyone erase evidence.
  it("G2: a contested entry stays visible, labelled contested; the reason is stored for the moderator only", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    const reason = "This is my shop's UPI ID <b>really</b>";
    expect(await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason }, cfg)).toEqual({ ok: true, updated: 2 });
    const tier = await reported();
    expect(tier.contestPolicy).toBe("visible");
    expect(tier.entries).toHaveLength(1);
    expect(tier.entries[0]).toMatchObject({ reporters: 2, contested: true });
    expect(JSON.stringify(tier)).not.toContain("really");
    const { rows } = await pg.query<{ reason: string; status: string }>("select reason, status from contests");
    expect(rows).toEqual([{ reason, status: "pending" }]);
  });
  it("G2: an uncontested entry is not labelled", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    expect((await reported()).entries[0].contested).toBe(false);
  });
  it("G2: dismissing a contest (MODERATION.md SQL) clears the label; upholding removes the reports", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID" }, cfg);
    const hash = (await pg.query<{ identifier_hash: string }>("select identifier_hash from contests")).rows[0].identifier_hash;
    await pg.query("update contests set status = 'dismissed', decided_at = now() where identifier_hash = $1 and status = 'pending'", [hash]);
    await pg.query("update reports set contested = false where identifier_hash = $1", [hash]);
    expect((await reported()).entries[0].contested).toBe(false);
    await pg.query("update contests set status = 'upheld', decided_at = now() where identifier_hash = $1", [hash]);
    await pg.query("delete from reports where identifier_hash = $1", [hash]);
    await pg.query("delete from graph_edges where src_hash = $1 or dst_hash = $1", [hash]);
    expect((await reported()).entries).toEqual([]);
  });
  it("G2 old-schema fallback: before migration 002, reading still works (old policy, said so) and contesting refuses instead of hiding", async () => {
    const old = await localDb({ migrations: false });
    const c = reportsConfig({ REPORT_HASH_PEPPER: PEPPER }, old.db);
    if (typeof c === "string") throw new Error(c);
    await submitReport(req(), fp(1), c);
    await submitReport(req(), fp(2), c);
    const before = await reportedFor(extractIdentifiers(UPI), c);
    expect(before).toMatchObject({ status: "ok", contestPolicy: "legacy_hidden" });
    expect(before.entries).toHaveLength(1);
    expect(await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID" }, c)).toEqual({ ok: false, reason: "contest_unavailable" });
    // Nothing was hidden by the refused contest.
    expect((await reportedFor(extractIdentifiers(UPI), c)).entries).toHaveLength(1);
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
  it("H4: every evidence path carries its links as node-id pairs that exist in the view (Q1, Q2, Q3)", async () => {
    const { edgeKey, onEvidencePath } = await import("../graph/edges");
    const env = { REPORT_HASH_PEPPER: PEPPER };
    const views = [
      await buildGraphView({ type: "upi", value: SEED_IDS.u1 }, env, db),
      await buildGraphView({ type: "evm", value: SEED_IDS.main }, env, db),
      await buildGraphView({ type: "evm", value: SEED_IDS.w2 }, env, db),
    ];
    const byQuery: Record<string, number> = {};
    for (const v of views) {
      const linkKeys = new Set(v.links.map((l) => edgeKey(l.source, l.target)));
      const ids = new Set(v.nodes.map((n) => n.id));
      for (const p of v.paths) {
        byQuery[p.query] = (byQuery[p.query] ?? 0) + p.edges.length;
        expect(p.edges.length, p.query).toBeGreaterThan(0);
        for (const [a, b] of p.edges) {
          expect(ids.has(a) && ids.has(b), `${p.query} ${a}-${b}`).toBe(true);
          expect(linkKeys.has(edgeKey(a, b)), `${p.query} ${a}-${b}`).toBe(true);
        }
        if (p.query === "Q3") for (const [a, b] of p.edges) expect([a, b].map((x) => v.nodes.find((n) => n.id === x)!.type)).toContain("telegram");
      }
      const on = onEvidencePath(v);
      expect(v.links.filter(on).length).toBe(new Set(v.paths.flatMap((p) => p.edges.map(([a, b]) => edgeKey(a, b)))).size);
    }
    expect(byQuery.Q1).toBe(4); // 2 paths x (upi-wallet, wallet-telegram)
    expect(byQuery.Q2).toBeGreaterThan(0);
    expect(byQuery.Q3).toBe(3); // the wallet's links to its 3 handles
  });
  it("F7: a graph view of the seeded scenario is flagged synthetic; a real identifier's view is not", async () => {
    const v = await buildGraphView({ type: "upi", value: SEED_IDS.u1 }, { REPORT_HASH_PEPPER: PEPPER }, db);
    expect(v.synthetic).toBe(true);
    const other = await buildGraphView({ type: "upi", value: "someone.else@okaxis" }, { REPORT_HASH_PEPPER: PEPPER }, db);
    expect(other.status).toBe("ok");
    expect(other.synthetic).toBe(false);
  });
  it("graph view without a database is 'unavailable'", async () => {
    expect((await buildGraphView({ type: "upi", value: SEED_IDS.u1 }, {}, null)).status).toBe("unavailable");
  });

  it("one reporter filing two reports cannot create a Q1 link or a Q3 cluster on their own", async () => {
    const solo = fp(77);
    const W = "0x" + "ab".repeat(20);
    await submitReport({ identifiers: [{ type: "upi", value: "solo.test@okdemo" }, { type: "evm", value: W }], category: "other", consent: true }, solo, cfg);
    await submitReport({ identifiers: [{ type: "evm", value: W }, { type: "telegram", value: "@zz_solo_one" }], category: "other", consent: true }, solo, cfg);
    await submitReport({ identifiers: [{ type: "evm", value: W }, { type: "telegram", value: "@zz_solo_two" }], category: "other", consent: true }, solo, cfg);
    const upiHash = (await import("./privacy")).identifierHash(PEPPER, "upi", "solo.test@okdemo");
    expect(await findLinks({ kind: "q1", upiHash }, deps())).toEqual([]);
    const clusters = await findLinks({ kind: "q3", minSize: 2 }, deps());
    expect(clusters.map((c) => c.handles.join())).not.toContain("@zz***ne,@zz***wo");
    expect(clusters.every((c) => c.reports >= 2)).toBe(true);
  });

  it("seeded UPI u1 shows as Reported (3 reporters), marked synthetic", async () => {
    const r = await reportedFor(extractIdentifiers(SEED_IDS.u1), cfg);
    expect(r.entries[0]).toMatchObject({ reporters: 3, synthetic: true });
  });
});

describe("G2 end to end: contesting cannot erase evidence or keep a High", () => {
  it("2 reports + scam text is High; after a contest it is visible, labelled, and Elevated", async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    const deps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date(), env: { REPORT_HASH_PEPPER: PEPPER }, db };
    const text = `Your KYC has expired, account will be blocked today. Pay the refund fee to ${UPI}`;
    expect((await runCheck({ text }, deps)).risk.level).toBe("high");
    await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID" }, cfg);
    const after = await runCheck({ text }, deps);
    expect(after.reported.entries).toHaveLength(1);
    expect(after.reported.entries[0].contested).toBe(true);
    expect(after.risk.level).toBe("elevated");
  });
});

describe("G2: the exact SQL in docs/MODERATION.md runs and does what it says", () => {
  const doc = readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "docs", "MODERATION.md"), "utf8");
  const blocks = [...doc.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
  const setup = async () => {
    await submitReport(req(), fp(1), cfg);
    await submitReport(req(), fp(2), cfg);
    await contestIdentifier({ identifier: { type: "upi", value: UPI }, reason: "This is my shop's UPI ID" }, cfg);
    return (await pg.query<{ id: number }>("select id from contests")).rows[0].id;
  };
  it("list, then dismiss: label cleared, reports kept", async () => {
    const id = await setup();
    const list = await pg.query<{ contest_id: number; independent_reporters: number }>(blocks[0]);
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0].independent_reporters).toBe(2);
    await pg.exec(blocks[1].replaceAll("123", String(id)));
    expect((await reported()).entries[0]).toMatchObject({ contested: false, reporters: 2 });
  });
  it("uphold: reports and graph edges removed", async () => {
    const id = await setup();
    await pg.exec(blocks[2].replaceAll("123", String(id)));
    expect((await reported()).entries).toEqual([]);
    expect((await pg.query("select 1 from reports")).rows).toHaveLength(0);
    expect((await pg.query<{ status: string }>("select status from contests")).rows[0].status).toBe("upheld");
  });
});
