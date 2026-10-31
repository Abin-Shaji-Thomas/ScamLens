// Seeds the Indian synthetic dataset (eval/india-cases.json, docs/DATASET.md). Every row is synthetic=true and
// labelled "Illustrative demo data"; re-running rewrites the same rows. Prints counts only, never identifiers or keys.
//   npx tsx scripts/seed-india-cases.ts            # --dry-run (default): counts, no writes
//   npx tsx scripts/seed-india-cases.ts --apply    # write to the Supabase project in web/.env.local
//   npx tsx scripts/seed-india-cases.ts --remove   # delete ONLY the rows this dataset wrote (by submission id and hash)
//   npx tsx scripts/seed-india-cases.ts --local    # seed an in-memory Postgres and print the query counts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { findLinks } from "../src/lib/graph";
import { datasetKeys, loadDemoVideoDataset, loadIndiaDataset, planCounts, removalStatements, seedIndia, type IndiaDataset } from "../src/lib/graph/india-dataset";
import { DEMO_LABEL } from "../src/lib/demo";
import { dbFromEnv } from "../src/lib/reports/db";
import { identifierHash } from "../src/lib/reports/privacy";
import { canonicalIdentifier, reportsConfig } from "../src/lib/reports/service";
import { localDb } from "../src/test-support/pglite";

const envFile = join(import.meta.dirname, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const args = new Set(process.argv.slice(2));

async function main() {
  const ds = loadIndiaDataset();
  const demo = loadDemoVideoDataset();
  console.log(`[${DEMO_LABEL}] Indian synthetic dataset + demo-video campaign`);
  console.log("plan:", JSON.stringify(planCounts(ds)), "demo-video:", JSON.stringify(planCounts(demo)));
  if (args.has("--remove")) {
    await remove(ds);
    return remove(demo);
  }
  if (!args.has("--apply") && !args.has("--local")) {
    console.log("dry run: nothing written (use --apply to write to Supabase, --local for an in-memory Postgres)");
    return;
  }
  const local = args.has("--local") ? await localDb() : null;
  const env: Record<string, string | undefined> = local ? { REPORT_HASH_PEPPER: "local-demo-pepper-not-secret" } : process.env;
  const db = local ? local.db : dbFromEnv(process.env);
  const cfg = reportsConfig(env, db);
  if (typeof cfg === "string") throw new Error(cfg);
  const counts = await seedIndia(cfg, ds);
  console.log("written:", JSON.stringify(counts));
  console.log("demo-video written:", JSON.stringify(await seedIndia(cfg, demo)));
  if (!counts.migration004) {
    console.log("HUMAN STEP: migration 004 is not in this database, so only reports and graph links were written (no case rows).");
    console.log("           Run web/db/migrations/004_cases_and_feedback.sql in the Supabase SQL editor, then run --apply again.");
  }
  // Query counts on Postgres (TigerGraph is checked by scripts/tg-setup.ts --load).
  const deps = { env: { ...env, TG_HOST: undefined, TG_SECRET: undefined }, db: cfg.db };
  const h = (t: "upi" | "evm", v: string) => identifierHash(cfg.pepper, t, canonicalIdentifier(t, v)!.value);
  const upis = [...new Set(ds.cases.flatMap((c) => c.identifiers.filter((i) => i.type === "upi").map((i) => i.value)))];
  const wallets = [...new Set(ds.cases.flatMap((c) => c.identifiers.filter((i) => i.type === "evm").map((i) => i.value)))];
  const q1 = (await Promise.all(upis.map((u) => findLinks({ kind: "q1", upiHash: h("upi", u) }, deps)))).filter((r) => r.length).length;
  const q2 = (await Promise.all(wallets.map((w) => findLinks({ kind: "q2", walletHash: h("evm", w) }, deps)))).filter((r) => r.length).length;
  const q3 = (await findLinks({ kind: "q3", minSize: 2 }, deps)).filter((r) => wallets.some((w) => h("evm", w) === r.wallet_hash)).length;
  console.log(`postgres: Q1 rows for ${q1} UPI ID(s), Q2 rows for ${q2} wallet(s), Q3 ${q3} dataset cluster(s)`);
}

async function remove(ds: IndiaDataset) {
  const pepper = process.env.REPORT_HASH_PEPPER ?? "";
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || pepper.length < 16) throw new Error("Supabase or REPORT_HASH_PEPPER not configured");
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { submissions, hashes } = datasetKeys(pepper, ds);
  const contested = ds.contested.map((v) => identifierHash(pepper, "upi", canonicalIdentifier("upi", v)!.value));
  // Same filters as removalStatements (used for local Postgres and the tests), expressed for the REST client.
  const steps: [string, () => PromiseLike<{ error: { message: string } | null; count: number | null }>][] = [
    ["cases", () => sb.from("cases").delete({ count: "exact" }).eq("synthetic", true).in("submission_id", submissions)],
    ["co_reported links", () => sb.from("graph_edges").delete({ count: "exact" }).eq("synthetic", true).in("submission_id", submissions)],
    ["payment links", () => sb.from("graph_edges").delete({ count: "exact" }).eq("synthetic", true).eq("relation", "payment").in("src_hash", hashes).in("dst_hash", hashes)],
    ["reports", () => sb.from("reports").delete({ count: "exact" }).eq("synthetic", true).in("submission_id", submissions)],
    ["flagged", () => sb.from("flagged_addresses").delete({ count: "exact" }).eq("synthetic", true).in("address_hash", hashes)],
    ["exchanges", () => sb.from("exchange_addresses").delete({ count: "exact" }).eq("synthetic", true).in("address_hash", hashes)],
    ["contests", () => sb.from("contests").delete({ count: "exact" }).in("identifier_hash", contested).like("reason", "Synthetic dataset:%")],
  ];
  if (removalStatements(pepper, ds).length !== steps.length) throw new Error("removal plan out of sync");
  for (const [name, run] of steps) {
    const { error, count } = await run();
    console.log(`removed ${name}: ${error ? (/does not exist|schema cache/.test(error.message) ? "table missing (skipped)" : "FAILED") : count}`);
  }
  console.log("TigerGraph keeps its copies until removed by hand (docs/MODERATION.md section 4).");
}

main().catch((e: unknown) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
