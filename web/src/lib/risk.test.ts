import { describe, expect, it } from "vitest";
import { localDb } from "../test-support/pglite";
import { runCheck } from "./check";
import type { RunDeps } from "./check";
import { reportsConfig, submitReport } from "./reports/service";
import { assessRisk, NO_REPORTS_MESSAGE, type RiskInput } from "./risk";

const none: RiskInput = { verifiedMatches: 0, reportedIdentifiers: 0, suspectedRules: 0, unavailableSources: 0 };

describe("assessRisk branches", () => {
  it("High: one verified match on its own", () => {
    expect(assessRisk({ ...none, verifiedMatches: 1 }).level).toBe("high");
  });
  it("High: 2-reporter identifier AND a suspected signal", () => {
    expect(assessRisk({ ...none, reportedIdentifiers: 1, suspectedRules: 1 }).level).toBe("high");
  });
  it("Elevated: reports without any suspected signal", () => {
    expect(assessRisk({ ...none, reportedIdentifiers: 1 }).level).toBe("elevated");
  });
  it("Elevated: suspected signals only, however many", () => {
    expect(assessRisk({ ...none, suspectedRules: 18 }).level).toBe("elevated");
  });
  it("Low: nothing found, labelled as not a guarantee", () => {
    const r = assessRisk(none);
    expect(r).toMatchObject({ level: "low", label: "Low signals - not a safety guarantee" });
  });
  it("Low with unavailable sources says the result is incomplete", () => {
    expect(assessRisk({ ...none, unavailableSources: 2 }).reasons.join(" ")).toMatch(/unavailable - result is incomplete/);
  });
  it("no-evidence message appears when there are no reports", () => {
    expect(assessRisk(none).reportedMessage).toBe(NO_REPORTS_MESSAGE);
    expect(NO_REPORTS_MESSAGE).toBe("No known reports. This does not mean safe.");
    expect(assessRisk({ ...none, reportedIdentifiers: 1 }).reportedMessage).toBeUndefined();
  });
  it("no 'no known reports' claim when the reports database is unavailable", () => {
    expect(assessRisk({ ...none, reportsAvailable: false }).reportedMessage).toBeUndefined();
  });
});

describe("end to end through runCheck", () => {
  const deps = (complete?: RunDeps["complete"]): RunDeps => ({
    fetch: (() => Promise.reject(new TypeError("offline"))) as typeof fetch,
    timeoutMs: 50,
    now: () => new Date("2026-10-29T00:00:00Z"),
    env: { OPENAI_MODEL: "test-model" },
    complete,
  });

  it("AI-only input with 5 signals never yields High", async () => {
    const text = "hello friend, nice weather today and the match was great, see you soon";
    const complete = async () =>
      JSON.stringify({
        signals: [
          { rule_id: "urgency_deadline", quote: "hello friend" },
          { rule_id: "guaranteed_returns", quote: "nice weather today" },
          { rule_id: "task_earn", quote: "the match was great" },
          { rule_id: "move_platform", quote: "see you soon" },
          { rule_id: "prize_lottery", quote: "the match" },
        ],
      });
    const r = await runCheck({ text }, deps(complete));
    expect(new Set(r.suspected.map((s) => s.rule_id)).size).toBe(5);
    expect(r.suspected.every((s) => s.source === "ai")).toBe(true);
    expect(r.risk.level).toBe("elevated");
  });

  it("an OFAC-listed address makes it High even with all remote sources offline", async () => {
    const r = await runCheck({ text: "send to 0x252a8bd2319d8a555b872990601221b3a2053bce" }, deps());
    expect(r.risk.level).toBe("high");
    expect(r.verified.some((v) => v.source === "ofac" && v.status === "match")).toBe(true);
  });

  it("plain text with nothing found is Low with the no-reports message (empty DB)", async () => {
    const { db } = await localDb();
    const d = { ...deps(async () => '{"signals":[]}'), db, env: { OPENAI_MODEL: "m", REPORT_HASH_PEPPER: "test-pepper-0123456789" } };
    const r = await runCheck({ text: "Meeting moved to 4 pm" }, d);
    expect(r.reported).toEqual({ status: "ok", entries: [] });
    expect(r.risk).toMatchObject({ level: "low", reportedMessage: NO_REPORTS_MESSAGE });
  });

  it("2-reporter identifier + suspected signal => High through runCheck", async () => {
    const { db } = await localDb();
    const env = { REPORT_HASH_PEPPER: "test-pepper-0123456789" };
    const cfg = reportsConfig(env, db);
    if (typeof cfg === "string") throw new Error(cfg);
    const req = { identifiers: [{ type: "upi" as const, value: "refund.desk@okdemo" }], category: "kyc_refund" as const, consent: true as const };
    await submitReport(req, "fp-a", cfg);
    await submitReport(req, "fp-b", cfg);
    const r = await runCheck({ text: "Pay withdrawal fee to refund.desk@okdemo" }, { ...deps(), db, env });
    expect(r.reported.entries).toHaveLength(1);
    expect(r.risk.level).toBe("high");
  });

  it("reports DB missing => reported tier 'unavailable', no 'no known reports' claim", async () => {
    const r = await runCheck({ text: "hello" }, { ...deps(async () => '{"signals":[]}'), db: null });
    expect(r.reported.status).toBe("unavailable");
    expect(r.risk.reportedMessage).toBeUndefined();
  });
});
