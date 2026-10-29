// TigerGraph setup + load + parity check, against the workspace in TG_HOST / TG_GRAPH / TG_SECRET.
//   npx tsx scripts/tg-setup.ts              # connect, schema (if missing), queries, load, parity
//   npx tsx scripts/tg-setup.ts --load       # only re-load data from Supabase and re-check parity
//   npx tsx scripts/tg-setup.ts --check      # only the parity check
// Data comes from the Supabase project in SUPABASE_URL (the source of truth); nothing is deleted.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findLinks, hubMax, tgConfig } from "../src/lib/graph";
import { postgresBackend } from "../src/lib/graph/postgres";
import { buildFullPayload } from "../src/lib/graph/tg-sync";
import { QUERY_NAMES, tigerGraphBackend, tigerGraphClient } from "../src/lib/graph/tigergraph";
import type { IdentifierType } from "../src/lib/extract/types";
import type { LinkQuery } from "../src/lib/graph/types";
import { dbFromEnv } from "../src/lib/reports/db";

const envFile = join(import.meta.dirname, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const GRAPH_DIR = join(import.meta.dirname, "..", "..", "graph");
const args = new Set(process.argv.slice(2));
const only = (flag: string) => args.size === 0 || args.has(flag);

async function main() {
  const tg = tgConfig(process.env);
  if (!tg) throw new Error("Set TG_HOST and TG_SECRET (and optionally TG_GRAPH, default ScamLens) in web/.env.local");
  const db = dbFromEnv(process.env);
  if (!db) throw new Error("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const client = tigerGraphClient({ ...tg, timeoutMs: 30_000 });
  const gsql = (file: string) => readFileSync(join(GRAPH_DIR, file), "utf8").replaceAll("ScamLens", tg.graph);

  console.log(`TigerGraph host: ${new URL(tg.host).host}  graph: ${tg.graph}`);
  console.log("1. connection:", JSON.stringify(await client.echo()).slice(0, 120));

  if (only("--schema")) {
    const exists = await client.request(`/gsql/v1/schema/graphs/${tg.graph}`).then(() => true, () => false);
    if (exists) {
      console.log(`2. schema: graph ${tg.graph} already exists - applying migrations`);
      for (const m of ["001_report_reporter_key.gsql"]) {
        const out = JSON.stringify(await client.statements(gsql(`migrations/${m}`)).catch((e: unknown) => String(e)));
        console.log(`   ${m}: ${/already exists|is already|exists in/i.test(out) ? "already applied" : out.slice(0, 300)}`);
      }
    } else console.log("2. schema:", JSON.stringify(await client.statements(gsql("schema.gsql"))).slice(0, 400));
  }

  if (only("--queries")) {
    const blocks = gsql("queries.gsql").split(/^(?=CREATE OR REPLACE QUERY )/m).filter((b) => b.startsWith("CREATE"));
    for (const b of blocks) {
      const name = /QUERY (\w+)\(/.exec(b)?.[1];
      console.log(`3. create ${name}:`, JSON.stringify(await client.createQuery(b)).slice(0, 300));
    }
    console.log("   installing (can take a few minutes)...");
    console.log("   install:", JSON.stringify(await client.installQueries(Object.values(QUERY_NAMES))).slice(0, 400));
  }

  if (only("--load")) {
    const b = await buildFullPayload(db);
    const c = b.counts();
    console.log(`4. load from Supabase: ${c.vertices} vertices, ${c.edges} edges`);
    console.log("   upsert:", JSON.stringify(await client.upsert(b.p)).slice(0, 300));
  }

  if (only("--check") || only("--load")) {
    const payload = (await buildFullPayload(db)).p;
    const ids = (vt: string) => Object.entries(payload.vertices[vt] ?? {}).map(([hash, a]) => ({ hash, kind: String(a.kind.value) as IdentifierType }));
    console.log(`   hub filter N = ${hubMax(process.env)}`);
    const pg = postgresBackend(db);
    const tgb = tigerGraphBackend({ ...tg, timeoutMs: 30_000 });
    const deps = { env: process.env, db };
    const norm = (rows: unknown[]) => JSON.stringify(rows.map((r) => JSON.stringify(r)).sort());
    const key: Record<LinkQuery["kind"], (r: never) => unknown> = {
      q1: (r: { wallet: string; telegram: string }) => [r.wallet, r.telegram],
      q2: (r: { path_display: string[] }) => r.path_display,
      q3: (r: { wallet: string; cluster_size: number; handles: string[]; reports: number }) => [r.wallet, r.cluster_size, r.handles, r.reports],
      q4: (r: { src: string; dst: string; relation: string; evidence: string }) => [r.src, r.dst, r.relation, r.evidence],
    };
    const cases: LinkQuery[] = [
      ...ids("UPI").map((u) => ({ kind: "q1" as const, upiHash: u.hash })),
      ...ids("Wallet").map((w) => ({ kind: "q2" as const, walletHash: w.hash })),
      { kind: "q3", minSize: 2 },
      ...[...ids("UPI"), ...ids("Wallet")].map((n) => ({ kind: "q4" as const, hash: n.hash, depth: 2, idType: n.kind })),
    ];
    let same = 0;
    const diffs: string[] = [];
    for (const q of cases) {
      const [a, b] = await Promise.all([findLinks(q, deps, pg), findLinks(q, deps, tgb)]);
      const ka = norm((a as never[]).map(key[q.kind]));
      const kb = norm((b as never[]).map(key[q.kind]));
      if (ka === kb) same++;
      else diffs.push(`${q.kind} ${JSON.stringify(q).slice(0, 60)}...\n     postgres:   ${ka.slice(0, 300)}\n     tigergraph: ${kb.slice(0, 300)}`);
    }
    console.log(`5. parity TigerGraph vs Postgres: ${same}/${cases.length} queries SAME`);
    for (const d of diffs) console.log(`   DIFFERENT ${d}`);
    for (const k of ["q1", "q2", "q3"] as const) {
      const c = cases.filter((x) => x.kind === k);
      if (!c.length) continue;
      const sample = await findLinks(c[0], deps, tgb);
      console.log(`   ${k} sample from TigerGraph (${c.length} case(s)): ${JSON.stringify(sample).slice(0, 260)}`);
    }
    if (diffs.length) process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
