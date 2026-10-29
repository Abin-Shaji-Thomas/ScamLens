import { describe, expect, it } from "vitest";
import { getHealth, HealthResponse } from "./health";

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
      ok: true, db: "not configured", reports: "not configured", graph: "none", usageStore: "memory", llm: false, vision: false, etherscan: false,
    });
  });

  it("everything configured: short statuses only, and no env value appears anywhere in the response", () => {
    const h = getHealth(SECRETS);
    expect(h).toEqual({ ok: true, db: "configured", reports: "configured", graph: "tigergraph", usageStore: "supabase", llm: true, vision: true, etherscan: true });
    const json = JSON.stringify(h);
    for (const v of Object.values(SECRETS)) {
      expect(json).not.toContain(v);
      expect(json).not.toContain(v.slice(0, 12));
    }
  });

  it("every value is a boolean or a short fixed status", () => {
    for (const v of Object.values(getHealth(SECRETS))) expect(typeof v === "boolean" || (typeof v === "string" && v.length <= 16)).toBe(true);
  });

  it("schema rejects ok:false", () => {
    expect(HealthResponse.safeParse({ ...getHealth({}), ok: false }).success).toBe(false);
  });
});
