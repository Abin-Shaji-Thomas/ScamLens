import type { Db } from "../reports/db";
import { postgresBackend } from "./postgres";
import { tigerGraphBackend } from "./tigergraph";
import type { GraphBackend, LinkQuery, LinkResult } from "./types";

export const DEFAULT_HUB_MAX = 25;

export interface GraphDeps {
  env: Record<string, string | undefined>;
  db: Db | null;
}

/** TigerGraph when TG_HOST/TG_GRAPH/TG_SECRET are set, else the Postgres recursive-CTE fallback. */
export function graphBackend({ env, db }: GraphDeps): GraphBackend | null {
  if (env.TG_HOST && env.TG_GRAPH && env.TG_SECRET) {
    return tigerGraphBackend({ host: env.TG_HOST.replace(/\/$/, ""), graph: env.TG_GRAPH, secret: env.TG_SECRET });
  }
  return db ? postgresBackend(db) : null;
}

export function hubMax(env: Record<string, string | undefined>): number {
  const n = Number(env.GRAPH_HUB_MAX);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_HUB_MAX;
}

/** Single entry point for link queries. Hub nodes (high-degree or exchange addresses) never link unrelated people. */
export async function findLinks<Q extends LinkQuery>(q: Q, deps: GraphDeps, backend = graphBackend(deps)): Promise<LinkResult<Q>> {
  if (!backend) throw new Error("no graph backend configured");
  return backend.run(q, hubMax(deps.env));
}
