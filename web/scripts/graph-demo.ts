// Seeds the synthetic scenario and runs Q1-Q3, comparing the database backend with
// the independent in-memory reference. Default: local PGlite (in-memory Postgres).
//   npx tsx scripts/graph-demo.ts              # local Postgres
//   npx tsx scripts/graph-demo.ts --supabase   # seed + query the configured Supabase project
import { existsSync } from "node:fs";
import { join } from "node:path";
import { findLinks, graphBackend, hubMax } from "../src/lib/graph";
import { refQ1, refQ2, refQ3 } from "../src/lib/graph/reference";
import { seedSynthetic, SYNTHETIC_WATERMARK } from "../src/lib/graph/seed";
import { dbFromEnv, type Db } from "../src/lib/reports/db";
import { reportsConfig } from "../src/lib/reports/service";
import { localDb } from "../src/test-support/pglite";

const envFile = join(import.meta.dirname, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  const useSupabase = process.argv.includes("--supabase");
  const db: Db | null = useSupabase ? dbFromEnv(process.env) : (await localDb()).db;
  if (!db) throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const env: Record<string, string | undefined> = {
    ...process.env,
    REPORT_HASH_PEPPER: process.env.REPORT_HASH_PEPPER ?? "local-demo-pepper-not-secret",
  };
  if (!useSupabase) for (const k of ["TG_HOST", "TG_GRAPH", "TG_SECRET"]) delete env[k];
  const cfg = reportsConfig(env, db);
  if (typeof cfg === "string") throw new Error(cfg);

  const backend = graphBackend({ env, db })!;
  const N = hubMax(env);
  console.log(`[${SYNTHETIC_WATERMARK}]  database=${useSupabase ? "supabase" : "pglite (local postgres)"}  graph backend=${backend.name}  hub N=${N}\n`);
  const s = await seedSynthetic(cfg);
  const deps = { env, db };
  const show = (label: string, got: string[], ref: string[]) => {
    console.log(label);
    for (const line of got) console.log(`   ${line}`);
    if (!got.length) console.log("   (no rows)");
    console.log(`   reference: ${JSON.stringify(ref)}  ->  ${JSON.stringify(got) === JSON.stringify(ref) ? "SAME" : "DIFFERENT"}\n`);
  };

  for (const k of ["u1", "u2"] as const) {
    const rows = await findLinks({ kind: "q1", upiHash: s.nodes[k].hash }, deps);
    for (const r of rows) console.log(`   evidence: [${r.evidence_1}] + [${r.evidence_2}]`);
    show(`Q1 UPI ${s.nodes[k].display} -> wallet -> Telegram:`, rows.map((r) => `${r.wallet} -> ${r.telegram}`).sort(), refQ1(s, s.nodes[k].hash, N));
  }
  for (const k of ["w2", "w4"] as const) {
    const rows = await findLinks({ kind: "q2", walletHash: s.nodes[k].hash }, deps);
    show(`Q2 wallet ${s.nodes[k].display} -> <=2 payment hops -> flagged:`, rows.map((r) => r.path_display.join(" -> ")).sort(), refQ2(s, s.nodes[k].hash, N));
  }
  const q3 = await findLinks({ kind: "q3", minSize: 2 }, deps);
  for (const r of q3) console.log(`   ${r.wallet}: handles ${r.handles.join(", ")} across ${r.reports} reports`);
  show("Q3 Telegram clusters sharing a wallet (min 2):", q3.map((r) => `${r.wallet}: ${r.cluster_size} handles`).sort(), refQ3(s, 2, N));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
