import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST as checkRoute } from "../app/api/check/route";
import { POST as contestRoute } from "../app/api/report/contest/route";
import { POST as graphRoute } from "../app/api/graph/route";
import { POST as reportRoute } from "../app/api/report/route";
import { localDb } from "../test-support/pglite";
import { readJsonBody } from "./body";
import { runCheck, type RunDeps } from "./check";
import { MAX_IDENTIFIERS, MAX_TEXT_CHARS, MIN_INDEPENDENT_REPORTERS, REPORT_RETENTION_DAYS } from "./limits";
import { FORBIDDEN_LOG_FIELDS, formatLog } from "./log";
import { fingerprintHash, reporterKey } from "./reports/privacy";
import { checkCsp, contentSecurityPolicy, parseCsp, REQUIRED_HEADERS, securityHeaders } from "./security-headers";

// PGlite suite: each localDb() starts Postgres in WebAssembly (about 1 s alone, about 8 s when six start in parallel
// under vitest's workers), so the default 5 s limit was flaky. Explicit timeouts; no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const SRC = join(import.meta.dirname, "..");
const post = (body: string) => new Request("http://x/api", { method: "POST", body });

describe("input limits", () => {
  it("rejects an oversize body with 413 before parsing, without echoing it", async () => {
    const huge = JSON.stringify({ text: "a".repeat(MAX_TEXT_CHARS * 3) });
    for (const route of [checkRoute, reportRoute, contestRoute, graphRoute]) {
      const res = await route(post(huge));
      expect(res.status).toBe(413);
      const text = await res.text();
      expect(text).not.toContain("aaaa");
      expect(text).toContain("at most 6,000 characters");
    }
  });
  it("rejects text over MAX_TEXT_CHARS with a friendly 400", async () => {
    const res = await checkRoute(post(JSON.stringify({ text: "b".repeat(MAX_TEXT_CHARS + 1) })));
    expect(res.status).toBe(400);
    expect((await res.json()).issues[0]).toMatch(/at most 6000 characters/);
  });
  it("invalid JSON is a 400 with a plain message", async () => {
    const r = await readJsonBody(post("{not json"), z.object({ a: z.string() }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
  it("checks at most MAX_IDENTIFIERS identifiers and says so", async () => {
    const handles = Array.from({ length: 25 }, (_, i) => `@zz_demo_user_${String(i).padStart(2, "0")}`).join(" ");
    const deps: RunDeps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date(), env: {}, db: null };
    const r = await runCheck({ text: handles }, deps);
    expect(r.identifiers).toHaveLength(MAX_IDENTIFIERS);
    expect(r.notices).toContain(`Only the first ${MAX_IDENTIFIERS} identifiers were checked.`);
  });
});

describe("safe logger", () => {
  it.each(FORBIDDEN_LOG_FIELDS)("rejects a field named %s", (field) => {
    expect(() => formatLog("check", { [field]: "user content" } as never)).toThrow(/not allowed/);
  });
  it("allows only event, status and duration", () => {
    expect(JSON.parse(formatLog("check", { status: "high", durationMs: 12.6 }))).toEqual({ event: "check", status: "high", durationMs: 13 });
  });
  it("rejects free text smuggled into status or the event name", () => {
    expect(() => formatLog("check", { status: "pay me at rahul@okaxis" })).toThrow();
    expect(() => formatLog("send money to 9876543210")).toThrow();
  });
  it("app code never calls console.* directly (only log.ts does)", () => {
    const offenders = sourceFiles().filter((f) => !f.endsWith("log.ts") && /console\.(log|error|warn|info|debug)\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("security headers", () => {
  it("sets the required headers", () => {
    const h = Object.fromEntries(securityHeaders(false).map((x) => [x.key, x.value]));
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(h["Content-Security-Policy"]).toMatch(/default-src 'self'/);
  });
  it("CSP: no unsafe-eval and no third-party origins in production; frames denied", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:\/\//);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy(true)).toContain("unsafe-eval"); // React dev tooling needs it (Next docs)
  });
});

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

describe("no-accusation wording", () => {
  const BANNED = /\b(scammers?|fraudsters?|criminals?|guilty|confirmed scams?)\b/i;
  it("no banned word appears anywhere in src (excluding tests)", () => {
    const hits = sourceFiles().flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => (BANNED.test(line) ? `${f}:${i + 1}` : null))
        .filter(Boolean),
    );
    expect(hits).toEqual([]);
  });
});

describe("report independence", () => {
  it("SQL thresholds match the code constants", () => {
    const sql = readFileSync(join(SRC, "..", "db", "schema.sql"), "utf8");
    expect(sql).toContain(`having count(distinct r.reporter_fingerprint_hash) >= ${MIN_INDEPENDENT_REPORTERS}`);
    expect(sql).toContain(`interval '${REPORT_RETENTION_DAYS} days'`);
  });
  it("fingerprint depends on the IP only: changing the browser does not create a new reporter", () => {
    expect(fingerprintHash("pepper-0123456789abcd", "10.0.0.1")).toBe(fingerprintHash("pepper-0123456789abcd", "10.0.0.1"));
    expect(fingerprintHash("pepper-0123456789abcd", "10.0.0.1")).not.toBe(fingerprintHash("pepper-0123456789abcd", "10.0.0.2"));
    expect(fingerprintHash.length).toBe(2);
  });
  it("reporterKey in TypeScript equals the SQL formula", async () => {
    const { pg } = await localDb();
    const fp = "abc123";
    const { rows } = await pg.query<{ k: string }>(
      "select left(encode(sha256(convert_to('reporter:' || $1, 'UTF8')), 'hex'), 16) as k",
      [fp],
    );
    expect(rows[0].k).toBe(reporterKey(fp));
  });
});

describe("G1: CSP directives", () => {
  it("production CSP has exactly the required sources for each directive", () => {
    const failures = checkCsp(contentSecurityPolicy(false)).filter((c) => !c.ok);
    expect(failures).toEqual([]);
  });
  it("img-src keeps data: and blob: (screenshot previews), font-src stays self-only", () => {
    const csp = parseCsp(contentSecurityPolicy(false));
    expect(csp["img-src"]).toEqual(expect.arrayContaining(["'self'", "data:", "blob:"]));
    expect(csp["font-src"]).toEqual(["'self'"]);
  });
  it("development adds only 'unsafe-eval' to script-src", () => {
    const dev = parseCsp(contentSecurityPolicy(true));
    const prod = parseCsp(contentSecurityPolicy(false));
    expect(dev["script-src"]).toEqual([...prod["script-src"], "'unsafe-eval'"]);
    expect({ ...dev, "script-src": prod["script-src"] }).toEqual(prod);
  });
  it("the checker itself catches a broken policy", () => {
    expect(checkCsp("default-src 'self'; script-src 'self'").some((c) => c.name === "csp script-src" && !c.ok)).toBe(true);
    expect(checkCsp("script-src 'self' 'unsafe-inline' https://cdn.example").some((c) => !c.ok)).toBe(true);
    expect(checkCsp(null)[0].ok).toBe(false);
  });
  it("other headers keep their values", () => {
    const h = Object.fromEntries(securityHeaders(false).map((x) => [x.key.toLowerCase(), x.value]));
    for (const [k, v] of Object.entries(REQUIRED_HEADERS)) expect(h[k]).toBe(v);
  });
});
