import { beforeEach, describe, expect, it } from "vitest";
import { localDb } from "../../test-support/pglite";
import type { Db } from "../reports/db";
import { reportsConfig } from "../reports/service";
import { tgConfig } from "./index";
import { seedSynthetic, SEED_IDS, type Scenario } from "./seed";
import { buildFullPayload, PayloadBuilder, reportEvidence } from "./tg-sync";
import { mapResult, queryParams, tigerGraphBackend } from "./tigergraph";
import { buildGraphView } from "./view";
import type { GraphBackend } from "./types";

const PEPPER = "test-pepper-0123456789";
const HOST = "https://ws.example.i.tgcloud.io";

type Call = { url: string; init?: RequestInit };
function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Call[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { f, calls };
}
const ok = (results: unknown) => new Response(JSON.stringify({ error: false, message: "", results }), { status: 200 });

describe("tgConfig", () => {
  it("needs host + secret, defaults the graph name, adds https://", () => {
    expect(tgConfig({})).toBeNull();
    expect(tgConfig({ TG_HOST: "ws.i.tgcloud.io/", TG_SECRET: "s" })).toEqual({ host: "https://ws.i.tgcloud.io", graph: "ScamLens", secret: "s" });
    expect(tgConfig({ TG_HOST: "h", TG_SECRET: "s", TG_GRAPH: "bad name;" })).toBeNull();
  });
});

describe("query parameters (REST++ conventions)", () => {
  it("typed vertex params are the bare id; untyped q4 vertex carries v.type", () => {
    expect(queryParams({ kind: "q1", upiHash: "abc" }, 25).toString()).toBe("hub_max=25&upi=abc");
    expect(queryParams({ kind: "q2", walletHash: "w" }, 3).toString()).toBe("hub_max=3&wallet=w");
    expect(queryParams({ kind: "q4", hash: "h", depth: 2, idType: "telegram" }, 25).toString()).toBe("hub_max=25&center=h&center.type=TelegramHandle&depth=2");
  });
});

describe("response mapping to the Postgres row shapes", () => {
  it("Q2 flattened tuple -> path arrays trimmed to hop count", () => {
    const rows = mapResult({ kind: "q2", walletHash: "a" }, {
      results: [{ rows: [{ hops: 1, p0: "a", p1: "b", p2: "", d0: "A", d1: "B", d2: "", flagged_source: "OFAC", e1: "tx1", e2: "" }] }],
    });
    expect(rows).toEqual([{ hops: 1, path: ["a", "b"], path_display: ["A", "B"], flagged_source: "OFAC", evidence: ["tx1"] }]);
  });
  it("Q3 rows are joined with the handles map", () => {
    const rows = mapResult({ kind: "q3", minSize: 2 }, {
      results: [{ rows: [{ wallet: "W", wallet_hash: "wh", cluster_size: 2, reports: 2 }], handles: { wh: ["@b", "@a"] } }],
    });
    expect(rows).toEqual([{ wallet: "W", wallet_hash: "wh", cluster_size: 2, handles: ["@a", "@b"], reports: 2 }]);
  });
});

describe("tigerGraphBackend over REST", () => {
  it("requests a token from the secret, then runs the installed query with Bearer auth", async () => {
    const { f, calls } = mockFetch((url) => (url.endsWith("/gsql/v1/tokens") ? new Response(JSON.stringify({ token: "T0K" })) : ok([{ rows: [] }])));
    await tigerGraphBackend({ host: HOST, graph: "ScamLens", secret: "sec", fetch: f }).run({ kind: "q1", upiHash: "h1" }, 25);
    expect(calls[0].url).toBe(`${HOST}/gsql/v1/tokens`);
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ secret: "sec" });
    expect(calls[1].url).toBe(`${HOST}/restpp/query/ScamLens/q1_upi_wallet_telegram?hub_max=25&upi=h1`);
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe("Bearer T0K");
  });
  it("falls back to the GSQL-Secret header when the token endpoint fails", async () => {
    const { f, calls } = mockFetch((url) => (url.endsWith("/tokens") ? new Response("nope", { status: 404 }) : ok([{ rows: [] }])));
    await tigerGraphBackend({ host: HOST, graph: "G", secret: "sec", fetch: f }).run({ kind: "q3", minSize: 2 }, 25);
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe("GSQL-Secret sec");
  });
  it("an identifier that was never loaded is 'no links', not an outage", async () => {
    const { f } = mockFetch((url) =>
      url.endsWith("/tokens")
        ? new Response(JSON.stringify({ token: "t" }))
        : new Response(JSON.stringify({ error: true, message: "Failed to convert user vertex id for parameter upi" }), { status: 200 }),
    );
    expect(await tigerGraphBackend({ host: HOST, graph: "G", secret: "s", fetch: f }).run({ kind: "q1", upiHash: "x" }, 25)).toEqual([]);
  });
  it("a wrong graph name / uninstalled query is an error, not 'no links'", async () => {
    const { f } = mockFetch((url) =>
      url.endsWith("/tokens")
        ? new Response(JSON.stringify({ token: "t" }))
        : new Response(JSON.stringify({ error: true, message: "Endpoint is not found from url = /query/Typo/q1" }), { status: 404 }),
    );
    await expect(tigerGraphBackend({ host: HOST, graph: "Typo", secret: "s", fetch: f }).run({ kind: "q1", upiHash: "x" }, 25)).rejects.toThrow(/not found/);
  });
  it("other TigerGraph errors are thrown", async () => {
    const { f } = mockFetch((url) => (url.endsWith("/tokens") ? new Response(JSON.stringify({ token: "t" })) : new Response("down", { status: 503 })));
    await expect(tigerGraphBackend({ host: HOST, graph: "G", secret: "s", fetch: f }).run({ kind: "q3", minSize: 2 }, 25)).rejects.toThrow(/HTTP 503/);
  });
});

describe("loader payload from Postgres (synthetic seed)", () => {
  let db: Db;
  let s: Scenario;
  beforeEach(async () => {
    ({ db } = await localDb());
    const cfg = reportsConfig({ REPORT_HASH_PEPPER: PEPPER }, db);
    if (typeof cfg === "string") throw new Error(cfg);
    s = await seedSynthetic(cfg);
  });

  it("one Report vertex per multi-identifier submission, one MENTIONS per member, one PAID per transfer", async () => {
    const p = (await buildFullPayload(db)).p;
    expect(Object.keys(p.vertices.Report)).toHaveLength(8); // seed reports 1-4 and 6-9 (report 5 names one identifier)
    const mentions = Object.values(p.edges.Report).reduce((n, e) => n + Object.values(e.MENTIONS).reduce((m, t) => m + Object.keys(t).length, 0), 0);
    expect(mentions).toBe(16);
    const paid = Object.values(p.edges.Wallet).reduce((n, e) => n + Object.keys(e.PAID.Wallet).length, 0);
    expect(paid).toBe(5);
  });
  it("carries flags, exchange labels, masked displays and the exact Postgres evidence text", async () => {
    const p = (await buildFullPayload(db)).p;
    expect(p.vertices.Wallet[s.nodes.f1.hash].flagged_source.value).toBe("synthetic flag (demo)");
    expect(p.vertices.Wallet[s.nodes.ex.hash].is_exchange.value).toBe(true);
    expect(p.vertices.UPI[s.nodes.u1.hash]).toMatchObject({ kind: { value: "upi" }, display: { value: s.nodes.u1.display } });
    const evidence = Object.values(p.vertices.Report).map((r) => r.evidence.value);
    expect(evidence.every((e) => /^Named together in one \w+ report on \d{4}-\d{2}-\d{2}$/.test(String(e)))).toBe(true);
    expect(JSON.stringify(p)).not.toContain(SEED_IDS.u1); // raw identifiers never leave Postgres
  });
  it("incremental report payload matches the SQL evidence format", () => {
    const b = new PayloadBuilder();
    b.report("sub-1", reportEvidence("investment", new Date("2026-10-29T10:00:00Z")), false, [
      { hash: "a", type: "upi", display: "a***@x" },
      { hash: "b", type: "evm", display: "0x12***34" },
    ]);
    expect(b.counts()).toEqual({ vertices: 3, edges: 2 });
    expect(b.p.vertices.Report["sub-1"].evidence.value).toBe("Named together in one investment report on 2026-10-29");
  });
  it("graph view falls back to Postgres when TigerGraph fails, and says so", async () => {
    const broken: GraphBackend = { name: "tigergraph", run: async () => Promise.reject(new Error("TigerGraph down")) };
    const v = await buildGraphView({ type: "upi", value: SEED_IDS.u1 }, { REPORT_HASH_PEPPER: PEPPER }, db, broken);
    expect(v.status).toBe("ok");
    expect(v.backend).toBe("postgres (TigerGraph unavailable)");
    expect(v.paths.filter((x) => x.query === "Q1")).toHaveLength(2);
  });
});
