import { describe, expect, it } from "vitest";
import { buildId, getHealth, HealthResponse } from "./health";

const SECRETS = {
  SUPABASE_URL: "https://sentinel-supabase-url-1111.example",
  SUPABASE_SERVICE_ROLE_KEY: "sentinel-service-role-2222",
  REPORT_HASH_PEPPER: "sentinel-pepper-3333-abcdefghijkl",
  TG_HOST: "sentinel-tg-host-4444.example",
  TG_SECRET: "sentinel-tg-secret-5555",
  TG_GRAPH: "SentinelGraph6666",
  OPENAI_API_KEY: "sk-sentinel-7777",
  OPENAI_MODEL: "sentinel-model-8888",
  ETHERSCAN_API_KEY: "sentinel-etherscan-9999",
};

describe("health", () => {
  it("nothing configured: ok with 'not configured' statuses", () => {
    expect(getHealth({})).toEqual({
      ok: true, db: "not configured", reports: "not configured", graph: "none", usageStore: "memory", llm: false, vision: false, etherscan: false, build: "local",
    });
  });

  it("everything configured: short statuses only, and no env value appears anywhere in the response", () => {
    const h = getHealth(SECRETS);
    expect(h).toEqual({ ok: true, db: "configured", reports: "configured", graph: "tigergraph", usageStore: "supabase", llm: true, vision: true, etherscan: true, build: "local" });
    const json = JSON.stringify(h);
    for (const v of Object.values(SECRETS)) {
      expect(json).not.toContain(v);
      expect(json).not.toContain(v.slice(0, 12));
    }
  });

  it("every value is a boolean or a short fixed status", () => {
    for (const v of Object.values(getHealth({ ...SECRETS, VERCEL_GIT_COMMIT_SHA: "abcdef0123456789" }))) expect(typeof v === "boolean" || (typeof v === "string" && v.length <= 16)).toBe(true);
  });

  it("build: the only added key is the first 7 hex characters of the deployed commit, or 'local'", () => {
    const sha = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b";
    const h = getHealth({ ...SECRETS, VERCEL_GIT_COMMIT_SHA: sha });
    expect(Object.keys(h).sort()).toEqual(["build", "db", "etherscan", "graph", "llm", "ok", "reports", "usageStore", "vision"]);
    expect(h.build).toBe("1a2b3c4");
    const json = JSON.stringify(h);
    expect(json).not.toContain(sha.slice(0, 8)); // never more than 7 characters of it
    for (const v of Object.values(SECRETS)) expect(json).not.toContain(v.slice(0, 12)); // and still no secret
    // anything that is not a commit hash is not echoed
    for (const bad of ["sk-sentinel-7777", "", "ABCDEFG", "12345<6", "1234"]) expect(buildId(bad)).toBe("local");
    expect(buildId("ABCDEF1234")).toBe("abcdef1");
    expect(HealthResponse.safeParse({ ...h, build: "sk-sent" }).success).toBe(false);
  });

  it("schema rejects ok:false", () => {
    expect(HealthResponse.safeParse({ ...getHealth({}), ok: false }).success).toBe(false);
  });
});
