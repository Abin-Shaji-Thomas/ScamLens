import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as statsRoute } from "../../app/api/graph/stats/route";
import { graphStatsSentence } from "../../components/GraphStatsLine";
import { localDb } from "../../test-support/pglite";
import { reportsConfig } from "../reports/service";
import { guardRequest, MemoryUsageStore } from "../usage";
import { seedSynthetic } from "./seed";
import { graphStats, resetGraphStatsCacheForTests, STATS_CACHE_MS, statsResponse } from "./stats";
import { GraphStats } from "./stats-schema";

// PGlite suite (see pglite.ts): explicit timeouts for start-up under parallel load.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const PEPPER = "test-pepper-0123456789";
const TG = { TG_HOST: "https://tg.example", TG_SECRET: "SECRET-stat-123", TG_GRAPH: "ScamLens" };
const tgFetch = (ok = true) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/gsql/v1/tokens")) return new Response(JSON.stringify({ token: "tok-123456" }), { status: 200 });
    if (!ok) return new Response("Failed to start workspace", { status: 500 });
    const fn = JSON.parse(String(init?.body)).function;
    return new Response(JSON.stringify({ error: false, results: fn === "stat_vertex_number" ? [{ v_type: "Report", count: 8 }, { v_type: "Wallet", count: 14 }] : [{ e_type: "MENTIONS", count: 16 }, { e_type: "PAID", count: 5 }] }), { status: 200 });
  }) as unknown as typeof fetch;

beforeEach(() => resetGraphStatsCacheForTests());

describe("graph statistics for /about (G4d)", () => {
  it("success: TigerGraph's built-in counts are summed, validated and contain no secret", async () => {
    const s = await graphStats({ env: TG, db: null, fetch: tgFetch() });
    expect(s).toMatchObject({ backend: "tigergraph", vertices: 22, edges: 21 });
    expect(GraphStats.safeParse(s).success).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/SECRET|tok-|tg\.example/);
    expect(graphStatsSentence(s!)).toBe("Right now the graph holds 22 vertices (identifiers and reports) and 21 links, counted by TigerGraph.");
  });

  it("fallback: TigerGraph down -> the same counts from the Postgres copy, said plainly", async () => {
    const { db } = await localDb();
    const cfg = reportsConfig({ REPORT_HASH_PEPPER: PEPPER }, db);
    if (typeof cfg === "string") throw new Error(cfg);
    await seedSynthetic(cfg);
    const s = await graphStats({ env: TG, db, fetch: tgFetch(false) });
    expect(s?.backend).toBe("postgres");
    expect(s!.vertices).toBeGreaterThan(0);
    expect(graphStatsSentence(s!)).toMatch(/counted by the Postgres copy \(TigerGraph is unavailable right now\)\.$/);
  });

  it("failure: nothing answers -> null, the response is 404 with a plain message, and the line renders nothing", async () => {
    expect(await graphStats({ env: {}, db: null })).toBeNull();
    const res = await statsResponse(new Request("http://x/api/graph/stats"), { env: {}, db: null }, async () => ({ ok: true }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "Graph statistics are not available right now." });
    const { GraphStatsLine } = await import("../../components/GraphStatsLine");
    expect(renderToStaticMarkup(createElement(GraphStatsLine))).toBe("");
  });

  it("success response: 200 with the counts and a 5-minute cache header", async () => {
    const res = await statsResponse(new Request("http://x/api/graph/stats"), { env: TG, db: null, fetch: tgFetch() }, async () => ({ ok: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    expect(GraphStats.parse(await res.json())).toMatchObject({ vertices: 22, edges: 21 });
  });

  it("cache: a second call within 5 minutes does not query again", async () => {
    const f = tgFetch();
    const now = new Date("2026-10-30T10:00:00Z");
    await graphStats({ env: TG, db: null, fetch: f, now: () => now });
    const calls = (f as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await graphStats({ env: TG, db: null, fetch: f, now: () => new Date(now.getTime() + STATS_CACHE_MS - 1000) });
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
    await graphStats({ env: TG, db: null, fetch: f, now: () => new Date(now.getTime() + STATS_CACHE_MS + 1000) });
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(calls);
  });

  it("the response is rate-limited by the graph daily limit (no graph query when over)", async () => {
    const store = new MemoryUsageStore();
    const guard = (h: Headers) => guardRequest("graph", h, false, { store, env: { USAGE_GRAPH_PER_DAY: "1" } });
    const f = tgFetch();
    const req = () => new Request("http://x/api/graph/stats", { headers: { "x-forwarded-for": "203.0.113.51" } });
    expect((await statsResponse(req(), { env: TG, db: null, fetch: f }, guard)).status).toBe(200);
    resetGraphStatsCacheForTests();
    const calls = (f as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect((await statsResponse(req(), { env: TG, db: null, fetch: f }, guard)).status).toBe(429);
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
    expect(typeof statsRoute).toBe("function"); // the route only adds connection() around statsResponse
  });
});
