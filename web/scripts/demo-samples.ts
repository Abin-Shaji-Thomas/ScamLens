// Runs the three README demo samples against a ScamLens deployment and prints a summary.
//   npx tsx scripts/demo-samples.ts [baseUrl]   (default http://localhost:3000)
import { CheckResponse } from "../src/lib/api-schema";
import { SAMPLE_WATERMARK, SAMPLES } from "../src/lib/samples";

async function main() {
  const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`[${SAMPLE_WATERMARK}]  target: ${base}\n`);
  for (const s of SAMPLES) {
    const res = await fetch(`${base}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: s.text }),
    });
    const r = CheckResponse.parse(await res.json());
    console.log(`${s.title}  ->  HTTP ${res.status}  ${r.risk.label}`);
    console.log(`   identifiers: ${r.identifiers.map((i) => `${i.type} ${i.value}`).join(" | ") || "none"}`);
    const counts = (st: string) => r.verified.filter((v) => v.status === st).length;
    console.log(`   verified: ${counts("match")} match, ${counts("no_match")} not listed, ${counts("info")} info, ${counts("unavailable")} unavailable`);
    for (const v of r.verified.filter((v) => v.status === "match")) console.log(`     MATCH ${v.sourceName}: ${v.summary}`);
    console.log(`   reported: ${r.reported.status}${r.reported.reason ? ` (${r.reported.reason})` : ""}, ${r.reported.entries.length} entries`);
    console.log(`   suspected: ${[...new Set(r.suspected.map((x) => x.rule_id))].join(", ") || "none"}   (AI: ${r.ai.status})`);
    console.log(`   reasons: ${r.risk.reasons.join("; ")}\n`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
