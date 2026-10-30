import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkRoute } from "../app/api/check/route";
import { POST as contestRoute } from "../app/api/report/contest/route";
import { POST as graphRoute } from "../app/api/graph/route";
import { localDb } from "../test-support/pglite";

// PGlite suite: each localDb() starts Postgres in WebAssembly (about 1 s alone, about 8 s when six start in parallel
// under vitest's workers), so the default 5 s limit was flaky. Explicit timeouts; no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
import {
  AI_SKIPPED_GLOBAL,
  AI_SKIPPED_STORE,
  fingerprintKey,
  guardRequest,
  MemoryUsageStore,
  secondsUntilReset,
  setUsageStoreForTests,
  sqlUsageStore,
  usageLimits,
  withFallback,
  type UsageStore,
} from "./usage";

const WALLET = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";
const failing: UsageStore = { consume: () => Promise.reject(new Error("function increment_usage does not exist")) };
const post = (body: unknown, ip = "203.0.113.7") =>
  new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } });

/** A store where one key prefix is already exhausted. */
function exhausted(prefix: string): UsageStore {
  const mem = new MemoryUsageStore();
  return { consume: (key, limit) => (key.startsWith(prefix) ? Promise.resolve({ allowed: false, remaining: 0 }) : mem.consume(key, limit)) };
}

describe("usage stores", () => {
  it("memory store: allows up to the limit, then denies; a new UTC day resets", async () => {
    let now = new Date("2026-10-29T10:00:00Z");
    const s = new MemoryUsageStore(() => now);
    expect(await s.consume("k", 2)).toEqual({ allowed: true, remaining: 1 });
    expect(await s.consume("k", 2)).toEqual({ allowed: true, remaining: 0 });
    expect(await s.consume("k", 2)).toEqual({ allowed: false, remaining: 0 });
    expect((await s.consume("other", 2)).allowed).toBe(true);
    now = new Date("2026-10-30T00:00:01Z");
    expect((await s.consume("k", 2)).allowed).toBe(true);
  });

  it("SQL increment_usage: atomic count, denied calls are not counted", async () => {
    const { db, pg } = await localDb();
    const s = sqlUsageStore(db);
    expect(await s.consume("fp:a:check", 2)).toEqual({ allowed: true, remaining: 1 });
    expect(await s.consume("fp:a:check", 2)).toEqual({ allowed: true, remaining: 0 });
    expect(await s.consume("fp:a:check", 2)).toEqual({ allowed: false, remaining: 0 });
    expect(await s.consume("fp:b:check", 2)).toEqual({ allowed: true, remaining: 1 });
    const { rows } = await pg.query<{ count: number }>("select count from usage_counters where key = 'fp:a:check'");
    expect(rows[0].count).toBe(2);
    const fn = await pg.query<{ prosecdef: boolean; proconfig: string[] }>(
      "select prosecdef, proconfig from pg_proc where proname = 'increment_usage'",
    );
    expect(fn.rows[0].prosecdef).toBe(true);
    expect(fn.rows[0].proconfig).toContain('search_path=""');
  });

  it("store failure: falls back to memory and marks the answer degraded", async () => {
    const s = withFallback(failing);
    expect(await s.consume("k", 1)).toEqual({ allowed: true, remaining: 0, degraded: true });
    expect(await s.consume("k", 1)).toEqual({ allowed: false, remaining: 0, degraded: true });
  });

  it("defaults and env overrides (empty value keeps the default)", () => {
    // verify (server-side receipt checks) added in the final round
    expect(usageLimits({})).toEqual({ check: 40, transcribe: 10, graph: 100, contest: 3, verify: 60, globalLlm: 1500 });
    expect(usageLimits({ USAGE_VERIFY_PER_DAY: "5" }).verify).toBe(5);
    expect(usageLimits({ USAGE_CHECK_PER_DAY: "7", USAGE_GLOBAL_LLM_PER_DAY: "" })).toMatchObject({ check: 7, globalLlm: 1500 });
  });

  it("fingerprint key is a hash, never the IP", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7" });
    const k = fingerprintKey(h, { REPORT_HASH_PEPPER: "p".repeat(32) });
    expect(k).toMatch(/^fp:[0-9a-f]{32}$/);
    expect(k).not.toContain("203.0.113.7");
    expect(fingerprintKey(new Headers({ "x-forwarded-for": "198.51.100.1" }), { REPORT_HASH_PEPPER: "p".repeat(32) })).not.toBe(k);
  });

  it("Retry-After counts down to the next UTC midnight", () => {
    expect(secondsUntilReset(new Date("2026-10-29T23:59:00Z"))).toBe(60);
  });
});

describe("guardRequest", () => {
  const h = new Headers({ "x-forwarded-for": "203.0.113.7" });
  it("allowed: LLM allowed while under both caps", async () => {
    expect(await guardRequest("check", h, true, { store: new MemoryUsageStore(), env: {} })).toEqual({ ok: true, aiAllowed: true });
  });
  it("exceeded: 429 with Retry-After and a friendly message", async () => {
    const store = new MemoryUsageStore();
    const env = { USAGE_CHECK_PER_DAY: "1" };
    expect((await guardRequest("check", h, false, { store, env })).ok).toBe(true);
    const r = await guardRequest("check", h, false, { store, env });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(429);
    expect(Number(r.response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await r.response.json()).error).toMatch(/today's limit/);
  });
  it("global cap: the LLM is skipped with a notice, the request still runs", async () => {
    const r = await guardRequest("check", h, true, { store: exhausted("global:"), env: {} });
    expect(r).toEqual({ ok: true, aiAllowed: false, aiNotice: AI_SKIPPED_GLOBAL });
  });
  it("store failure: the LLM is skipped, local checks still allowed", async () => {
    const r = await guardRequest("check", h, true, { store: withFallback(failing), env: {} });
    expect(r).toEqual({ ok: true, aiAllowed: false, aiNotice: AI_SKIPPED_STORE });
  });
});

describe("routes", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", fetchSpy);
    for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REPORT_HASH_PEPPER", "ETHERSCAN_API_KEY", "TG_HOST", "TG_SECRET", "OPENAI_API_KEY", "OPENAI_MODEL"]) {
      vi.stubEnv(k, "");
    }
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setUsageStoreForTests(null);
  });

  it("under the limit the check route does call external sources (control)", async () => {
    setUsageStoreForTests(new MemoryUsageStore());
    const res = await checkRoute(post({ text: `pay ${WALLET}` }));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("over the limit: /api/check returns 429 and makes ZERO external calls", async () => {
    setUsageStoreForTests(exhausted("fp:"));
    const res = await checkRoute(post({ text: `pay ${WALLET}` }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("over the limit: /api/graph and /api/report/contest return 429 with no calls", async () => {
    setUsageStoreForTests(exhausted("fp:"));
    expect((await graphRoute(post({ type: "evm", value: WALLET }))).status).toBe(429);
    expect((await contestRoute(post({ identifier: { type: "evm", value: WALLET }, reason: "This is my own wallet." }))).status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("G2: the daily contest cap still applies (4th contest from one network is 429)", async () => {
    setUsageStoreForTests(new MemoryUsageStore());
    const body = { identifier: { type: "evm", value: WALLET }, reason: "This is my own wallet." };
    for (let i = 0; i < 3; i++) expect((await contestRoute(post(body, "203.0.113.77"))).status).not.toBe(429);
    const res = await contestRoute(post(body, "203.0.113.77"));
    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("G2: contest reasons are length-limited (under 10 or over 500 characters is a 400)", async () => {
    setUsageStoreForTests(new MemoryUsageStore());
    expect((await contestRoute(post({ identifier: { type: "evm", value: WALLET }, reason: "short" }))).status).toBe(400);
    expect((await contestRoute(post({ identifier: { type: "evm", value: WALLET }, reason: "x".repeat(501) }))).status).toBe(400);
  });
  it("per-fingerprint counters are per network: another IP is still allowed", async () => {
    vi.stubEnv("USAGE_GRAPH_PER_DAY", "1");
    setUsageStoreForTests(new MemoryUsageStore());
    expect((await graphRoute(post({ type: "evm", value: WALLET }, "203.0.113.9"))).status).toBe(200);
    expect((await graphRoute(post({ type: "evm", value: WALLET }, "203.0.113.9"))).status).toBe(429);
    expect((await graphRoute(post({ type: "evm", value: WALLET }, "198.51.100.4"))).status).toBe(200);
  });

  it("global LLM cap reached: the check runs regex-only with a notice and never calls the LLM", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    setUsageStoreForTests(exhausted("global:"));
    const res = await checkRoute(post({ text: "Your account will be blocked today, share the OTP now" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notices).toContain(AI_SKIPPED_GLOBAL);
    expect(body.suspected.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("usage store down: the check still works without AI and says why", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "test-model");
    setUsageStoreForTests(withFallback(failing));
    const res = await checkRoute(post({ text: "Your account will be blocked today, share the OTP now" }));
    expect(res.status).toBe(200);
    expect((await res.json()).notices).toContain(AI_SKIPPED_STORE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
