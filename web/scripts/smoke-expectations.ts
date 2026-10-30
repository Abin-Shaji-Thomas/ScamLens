// The fixed expectations of scripts/smoke-live.ts, kept apart so the docs can quote their count (docs-lib FACT
// smoke_expectations) without running the smoke test. Every list has a fixed length, whatever the response.
import type { CheckResponse } from "../src/lib/api-schema";
import { NO_REPORTS_MESSAGE } from "../src/lib/risk";
import { SAMPLES } from "../src/lib/samples";

export type Expect = { name: string; ok: boolean; detail?: string };

export const OFAC_SAMPLE_WALLET = "0x252a8bd2319d8a555b872990601221b3a2053bce";

export function tiersPresent(r: CheckResponse): Expect[] {
  return [
    { name: "verified tier present", ok: Array.isArray(r.verified) },
    { name: "reported tier present with a status", ok: r.reported.status === "ok" || r.reported.status === "unavailable" },
    { name: "suspected tier present", ok: Array.isArray(r.suspected) },
    // Principle 4: either "No known reports. This does not mean safe." or an explicit "unavailable".
    {
      name: "no-reports notice or 'reports unavailable' shown",
      ok: r.risk.reportedMessage === NO_REPORTS_MESSAGE || r.reported.status === "unavailable" || r.reported.entries.length > 0,
      detail: `reported.status=${r.reported.status}`,
    },
    { name: "notices array present", ok: Array.isArray(r.notices) },
    { name: "every quote is non-empty", ok: r.suspected.every((s) => s.quote.length > 0) },
  ];
}

export const PER_SAMPLE: Record<string, (r: CheckResponse) => Expect[]> = {
  "digital-arrest": (r) => [
    { name: "risk is elevated or high", ok: r.risk.level !== "low", detail: r.risk.level },
    { name: "digital_arrest signal", ok: r.suspected.some((s) => s.rule_id === "digital_arrest") },
    { name: "authority_impersonation signal", ok: r.suspected.some((s) => s.rule_id === "authority_impersonation") },
    { name: "UPI identifier extracted", ok: r.identifiers.some((i) => i.type === "upi") },
  ],
  "crypto-investment": (r) => [
    { name: "risk is high", ok: r.risk.level === "high", detail: r.risk.level },
    {
      name: "OFAC match on the sample wallet",
      ok: r.verified.some((v) => v.source === "ofac" && v.status === "match" && v.identifier.value.toLowerCase() === OFAC_SAMPLE_WALLET),
    },
    { name: "guaranteed_returns signal", ok: r.suspected.some((s) => s.rule_id === "guaranteed_returns") },
    { name: "every verified row has an https link", ok: r.verified.every((v) => v.link.startsWith("https://")) },
  ],
  "bank-alert": (r) => [
    { name: "risk is low", ok: r.risk.level === "low", detail: `${r.risk.level} (${r.suspected.map((s) => s.rule_id).join(",")})` },
    { name: "no suspected signals (negation guard)", ok: r.suspected.length === 0 },
  ],
};

/** /api/health: HTTP 200 and the schema. */
export const HEALTH_EXPECTATIONS = 2;

/** Expectations in a full run: health, then per sample HTTP 200, schema, the tier checks, its own checks and (with receipts on) one receipt check. */
export function smokeExpectationCount(receipts: boolean): number {
  const probe = { verified: [], suspected: [], identifiers: [], notices: [], reported: { status: "ok", entries: [] }, risk: { level: "low" } } as unknown as CheckResponse;
  const perSample = SAMPLES.map((s) => 2 + tiersPresent(probe).length + PER_SAMPLE[s.id](probe).length + (receipts ? 1 : 0));
  return HEALTH_EXPECTATIONS + perSample.reduce((a, b) => a + b, 0);
}
