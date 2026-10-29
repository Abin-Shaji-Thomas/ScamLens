import { describe, expect, it } from "vitest";
import type { CheckResponse } from "./api-schema";
import { buildEvidencePack, WATERMARK } from "./evidence-pack";
import { assessRisk } from "./risk";

const base: CheckResponse = {
  identifiers: [{ type: "upi", value: "zzdemo.verify@okdemo", raw: "zzdemo.verify@okdemo", start: 0, end: 20, check: "format" }],
  verified: [],
  reported: { status: "ok", entries: [] },
  suspected: [{ rule_id: "digital_arrest", label: "\"Digital arrest\" or arrest-warrant threat", quote: "digital arrest", start: 3, end: 17, source: "rule" }],
  ai: { status: "unavailable", reason: "not configured", dropped: 0 },
  risk: assessRisk({ verifiedMatches: 0, reportedIdentifiers: 0, suspectedRules: 1, unavailableSources: 0 }),
  notices: [],
  checkedAt: "2026-10-29T00:00:00.000Z",
};

describe("evidence pack", () => {
  const pack = buildEvidencePack(base);
  it("keeps the three tiers in separate, ordered sections", () => {
    const v = pack.indexOf("1. VERIFIED");
    const r = pack.indexOf("2. REPORTED");
    const s = pack.indexOf("3. SUSPECTED");
    expect(v).toBeGreaterThan(-1);
    expect(r).toBeGreaterThan(v);
    expect(s).toBeGreaterThan(r);
    expect(pack.slice(s)).toContain('"digital arrest"');
    expect(pack.slice(r, s)).toContain("No known reports. This does not mean safe.");
  });
  it("includes 1930, cybercrime.gov.in, bank contact and the not-legal-advice line", () => {
    expect(pack).toContain("1930");
    expect(pack).toContain("https://cybercrime.gov.in");
    expect(pack).toMatch(/bank/i);
    expect(pack).toContain("not legal advice");
  });
  it("states an unavailable reports DB instead of claiming no reports", () => {
    const p = buildEvidencePack({ ...base, reported: { status: "unavailable", entries: [], reason: "db down" } });
    expect(p).toContain("Reports database unavailable (db down). This is not a clean result.");
    expect(p).not.toContain("No known reports");
  });
  it("carries the watermark for demo data and never uses accusatory wording", () => {
    expect(buildEvidencePack(base, { demo: true }).startsWith(`*** ${WATERMARK} ***`)).toBe(true);
    expect(pack).not.toMatch(/scammer/i);
  });
});
