// Runs eval/qa-scenarios.json through runCheck offline (no network, no database) and, with a base URL, through a
// running server too, and prints per scenario: identifiers (type and check), counted rules, warning-context rules,
// level and reasons, next to the written hypothesis. Usage: npx tsx scripts/qa-scenarios.ts [http://localhost:3000]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CheckResponse } from "../src/lib/api-schema";
import { runCheck, type RunDeps } from "../src/lib/check";

interface Scenario {
  id: string;
  name: string;
  text: string;
  expected: { identifiers: string[]; counted: string[]; level: string; note?: string };
}
const file = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "eval", "qa-scenarios.json"), "utf8")) as { scenarios: Scenario[] };
const offline: RunDeps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date(), env: {}, db: null };

function summarise(r: CheckResponse) {
  return {
    identifiers: r.identifiers.map((i) => `${i.type}:${i.check}`),
    counted: [...new Set(r.suspected.filter((s) => s.context !== "warning").map((s) => s.rule_id))].sort(),
    warning: [...new Set(r.suspected.filter((s) => s.context === "warning").map((s) => s.rule_id))].sort(),
    level: r.risk.level,
    reasons: r.risk.reasons,
    verified: r.verified.filter((v) => v.status === "match").map((v) => v.source),
  };
}

async function main() {
const base = process.argv[2]?.replace(/\/+$/, "");
const rows = [];
for (const s of file.scenarios) {
  const off = summarise(await runCheck({ text: s.text }, offline));
  let live: ReturnType<typeof summarise> | string | null = null;
  if (base) {
    const res = await fetch(`${base}/api/check`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: s.text }) });
    live = res.ok ? summarise(CheckResponse.parse(await res.json())) : `HTTP ${res.status}`;
  }
  const want = [...s.expected.counted].sort();
  rows.push({
    id: s.id,
    name: s.name,
    expected: s.expected,
    offline: off,
    server: live,
    matches: {
      level: off.level === s.expected.level,
      counted: JSON.stringify(off.counted) === JSON.stringify(want),
      identifierTypes: JSON.stringify(off.identifiers.map((i) => i.split(":")[0]).sort()) === JSON.stringify(s.expected.identifiers.map((i) => i.split(":")[0]).sort()),
    },
  });
}
console.log(JSON.stringify(rows, null, 1));
}

void main();
