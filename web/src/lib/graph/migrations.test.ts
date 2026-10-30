import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { decideMigration, hasVertexAttribute, maskDetail, MIGRATIONS } from "./migrations";
import { tigerGraphClient } from "./tigergraph";

const GSQL = readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "graph", "migrations", "001_report_reporter_key.gsql"), "utf8");
const schema = (attrs: string[]) => ({ error: false, results: { GraphName: "ScamLens", VertexTypes: [{ Name: "Wallet", Attributes: [{ AttributeName: "kind" }] }, { Name: "Report", Attributes: attrs.map((a) => ({ AttributeName: a })) }] } });

describe("TigerGraph migrations (no global call from the graph token)", () => {
  it("attribute present: migration 001 is skipped", () => {
    expect(hasVertexAttribute(schema(["evidence", "synthetic", "reporter_key"]), "Report", "reporter_key")).toBe(true);
    expect(decideMigration(MIGRATIONS[0], schema(["evidence", "synthetic", "reporter_key"]), GSQL)).toEqual({ action: "skip", message: "migration 001 already applied (Report.reporter_key exists)" });
  });

  it("attribute missing: a human step with exit code 2 and the exact GSQL to run in the Savanna editor", () => {
    const d = decideMigration(MIGRATIONS[0], schema(["evidence", "synthetic"]), GSQL);
    expect(d.action).toBe("human");
    if (d.action !== "human") return;
    expect(d.exitCode).toBe(2);
    expect(d.message).toMatch(/^HUMAN STEP REQUIRED: migration 001/);
    expect(d.message).toContain("GSQL editor");
    expect(d.message).toContain('ALTER VERTEX Report ADD ATTRIBUTE (reporter_key STRING DEFAULT "");');
    expect(d.message).toContain("npx tsx scripts/tg-setup.ts");
    expect(hasVertexAttribute({}, "Report", "reporter_key")).toBe(false);
  });

  it("the migration file is what the owner ran by hand: USE GLOBAL, a STRING DEFAULT \"\" attribute, no DROP", () => {
    expect(GSQL).toMatch(/^USE GLOBAL$/m);
    expect(GSQL).toContain("CREATE GLOBAL SCHEMA_CHANGE JOB scamlens_add_reporter_key");
    expect(GSQL).toContain('ALTER VERTEX Report ADD ATTRIBUTE (reporter_key STRING DEFAULT "");');
    expect(GSQL).toContain("RUN GLOBAL SCHEMA_CHANGE JOB scamlens_add_reporter_key");
    expect(GSQL).not.toMatch(/^\s*DROP\b/im);
  });

  it("tg-setup never sends a migration: it only reads the schema before deciding", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "..", "..", "scripts", "tg-setup.ts"), "utf8");
    expect(src).toContain("decideMigration(m, schema");
    expect(src).not.toMatch(/statements\(gsql\(`migrations\//);
  });

  it("failure messages carry the response detail, masked and capped at 800 characters", () => {
    const detail = "line 4: Query q1 compile failed: undefined vertex type Phone. Authorization: Bearer abcdef123456 secret s3cr3t-value";
    const out = maskDetail(detail, ["s3cr3t-value"]);
    expect(out).toContain("compile failed: undefined vertex type Phone");
    expect(out).not.toContain("s3cr3t-value");
    expect(out).not.toContain("abcdef123456");
    expect(maskDetail("x".repeat(2000), [])).toHaveLength(803);
  });

  it("the client includes the body detail in its error and never the secret or token", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith("/gsql/v1/tokens")
        ? new Response(JSON.stringify({ token: "tok-ABCDEFGH1234" }), { status: 200 })
        : new Response(JSON.stringify({ error: true, message: "Semantic Check Fails: q2 uses tok-ABCDEFGH1234 and SECRET-xyz-987 at line 12" }), { status: 400 }),
    );
    const c = tigerGraphClient({ host: "https://tg.example", graph: "ScamLens", secret: "SECRET-xyz-987", fetch: fetch as unknown as typeof globalThis.fetch });
    const err = await c.createQuery("CREATE QUERY q2() {}").catch((e: Error) => e);
    expect(String(err)).toContain("Semantic Check Fails: q2 uses");
    expect(String(err)).toContain("at line 12");
    expect(String(err)).not.toContain("SECRET-xyz-987");
    expect(String(err)).not.toContain("tok-ABCDEFGH1234");
  });
});
