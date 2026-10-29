// Smoke test against a running deployment: /api/health and /api/check with the 3 built-in samples.
// Prints PASS/FAIL per expectation and exits 1 on any FAIL. Uses 3 of the day's checks for your network.
// Run from web/: npx tsx scripts/smoke-live.ts http://localhost:3000   (or the live URL)
import { CheckResponse } from "../src/lib/api-schema";
import { HealthResponse } from "../src/lib/health";
import { NO_REPORTS_MESSAGE } from "../src/lib/risk";
import { SAMPLES } from "../src/lib/samples";

type Expect = { name: string; ok: boolean; detail?: string };

const OFAC_SAMPLE_WALLET = "0x252a8bd2319d8a555b872990601221b3a2053bce";

function tiersPresent(r: CheckResponse): Expect[] {
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

const PER_SAMPLE: Record<string, (r: CheckResponse) => Expect[]> = {
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

async function main() {
  const base = (process.argv[2] ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    console.error("usage: npx tsx scripts/smoke-live.ts <base-url>");
    process.exit(2);
  }
  const results: Expect[] = [];
  const add = (scope: string, xs: Expect[]) => {
    for (const x of xs) {
      results.push(x);
      console.log(`${x.ok ? "PASS" : "FAIL"}  [${scope}] ${x.name}${x.detail ? ` (${x.detail})` : ""}`);
    }
  };

  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(20000) });
    const h = HealthResponse.safeParse(await res.json());
    add("health", [
      { name: "HTTP 200", ok: res.ok, detail: String(res.status) },
      { name: "schema (booleans/short statuses only)", ok: h.success },
    ]);
    if (h.success) console.log(`      health: ${JSON.stringify(h.data)}`);
  } catch (e) {
    add("health", [{ name: "reachable", ok: false, detail: e instanceof Error ? e.name : "error" }]);
  }

  for (const s of SAMPLES) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: s.text }),
        signal: AbortSignal.timeout(45000),
      });
      const body: unknown = await res.json();
      const parsed = CheckResponse.safeParse(body);
      add(s.id, [
        { name: "HTTP 200", ok: res.ok, detail: `${res.status}, ${Date.now() - t0} ms` },
        { name: "response schema", ok: parsed.success },
      ]);
      if (parsed.success) add(s.id, [...tiersPresent(parsed.data), ...PER_SAMPLE[s.id](parsed.data)]);
    } catch (e) {
      add(s.id, [{ name: "request completed", ok: false, detail: e instanceof Error ? e.name : "error" }]);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAIL`} (${results.length} expectations)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
