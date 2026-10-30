import { z } from "zod";
import { IdentifierType, type Identifier } from "../extract/types";
import type { Db } from "../reports/db";
import { identifierHash } from "../reports/privacy";
import { canonicalIdentifier } from "../reports/service";
import { findLinks, graphBackend } from "./index";
import { postgresBackend } from "./postgres";
import { buildScenario } from "./seed";
import type { GraphBackend } from "./types";

export const GraphRequest = z.object({ type: IdentifierType, value: z.string().trim().min(3).max(200) });

export const GraphView = z.object({
  status: z.enum(["ok", "unavailable"]),
  backend: z.string().optional(),
  reason: z.string().optional(),
  nodes: z.array(z.object({ id: z.string(), label: z.string(), type: z.string(), focus: z.boolean() })),
  links: z.array(z.object({ source: z.string(), target: z.string(), relation: z.string(), evidence: z.string() })),
  paths: z.array(z.object({ query: z.string(), text: z.string(), evidence: z.array(z.string()) })),
  /** Time the answering backend took for this view, in whole milliseconds (absent when nothing was queried). */
  elapsedMs: z.number().int().nonnegative().optional(),
  /** True when any node is part of the seeded synthetic scenario: the UI must label it "Illustrative demo data". */
  synthetic: z.boolean().default(false),
});
export type GraphView = z.infer<typeof GraphView>;

const short = (h: string) => h.slice(0, 12); // node ids are hash prefixes, never raw identifiers
const EMPTY = { nodes: [], links: [], paths: [], synthetic: false };

/** Exact check against the seed scenario's hashes (not a naming heuristic). */
function seedNodeIds(pepper: string): Set<string> {
  return new Set(Object.values(buildScenario(pepper).nodes).map((n) => short(n.hash)));
}

async function viewFrom(backend: GraphBackend, id: Identifier, hash: string, env: Record<string, string | undefined>, db: Db | null) {
  const deps = { env, db };
  const edges = await findLinks({ kind: "q4", hash, depth: 2, idType: id.type }, deps, backend);
  const nodes = new Map<string, GraphView["nodes"][number]>();
  for (const e of edges) {
    nodes.set(short(e.src), { id: short(e.src), label: e.src_display, type: e.src_type, focus: e.src === hash });
    nodes.set(short(e.dst), { id: short(e.dst), label: e.dst_display, type: e.dst_type, focus: e.dst === hash });
  }
  const links = edges.map((e) => ({ source: short(e.src), target: short(e.dst), relation: e.relation, evidence: e.evidence }));

  const paths: GraphView["paths"] = [];
  if (id.type === "upi") {
    for (const r of await findLinks({ kind: "q1", upiHash: hash }, deps, backend)) {
      paths.push({
        query: "Q1",
        text: `${r.upi} is linked to Telegram ${r.telegram} only through shared wallet ${r.wallet}.`,
        evidence: [r.evidence_1, r.evidence_2],
      });
    }
  }
  if (id.type === "evm") {
    for (const r of await findLinks({ kind: "q2", walletHash: hash }, deps, backend)) {
      paths.push({
        query: "Q2",
        text: `Funds moved ${r.path_display.join(" -> ")} (${r.hops} hop${r.hops > 1 ? "s" : ""}) to an address flagged by ${r.flagged_source}.`,
        evidence: r.evidence,
      });
    }
    for (const r of (await findLinks({ kind: "q3", minSize: 2 }, deps, backend)).filter((c) => c.wallet_hash === hash)) {
      paths.push({
        query: "Q3",
        text: `${r.cluster_size} different Telegram handles (${r.handles.join(", ")}) were reported together with this wallet by ${r.reports} different reporters.`,
        evidence: [],
      });
    }
  }
  const seed = seedNodeIds(env.REPORT_HASH_PEPPER ?? "");
  return { nodes: [...nodes.values()], links, paths, synthetic: [...nodes.keys()].some((k) => seed.has(k)) };
}

export async function buildGraphView(
  req: z.infer<typeof GraphRequest>,
  env: Record<string, string | undefined>,
  db: Db | null,
  backend: GraphBackend | null = graphBackend({ env, db }),
): Promise<GraphView> {
  const pepper = env.REPORT_HASH_PEPPER ?? "";
  if (!backend || pepper.length < 16) return { status: "unavailable", reason: "graph database not configured", ...EMPTY };
  const id = canonicalIdentifier(req.type, req.value);
  if (!id) return { status: "unavailable", reason: "invalid identifier", ...EMPTY };
  const hash = identifierHash(pepper, id.type, id.value);

  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  try {
    const v = await viewFrom(backend, id, hash, env, db);
    return { status: "ok", backend: backend.name, elapsedMs: ms(), ...v };
  } catch {
    // TigerGraph outage: answer from the Postgres copy of the same links, and say so.
    if (backend.name === "tigergraph" && db) {
      try {
        const t1 = performance.now();
        const v = await viewFrom(postgresBackend(db), id, hash, env, db);
        return { status: "ok", backend: "postgres (TigerGraph unavailable)", elapsedMs: Math.round(performance.now() - t1), ...v };
      } catch {
        /* fall through */
      }
    }
    return { status: "unavailable", backend: backend.name, reason: "graph query failed", ...EMPTY };
  }
}
