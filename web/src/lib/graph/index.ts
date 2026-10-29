import { positiveIntEnv } from "../env";
import type { Db } from "../reports/db";
import { postgresBackend } from "./postgres";
import { tigerGraphBackend, type TgConfig } from "./tigergraph";
import type { GraphBackend, LinkQuery, LinkResult } from "./types";

export const DEFAULT_HUB_MAX = 25;

export interface GraphDeps {
  env: Record<string, string | undefined>;
  db: Db | null;
}

const GRAPH_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** TigerGraph connection settings from env, or null when not configured. */
export function tgConfig(env: Record<string, string | undefined>): TgConfig | null {
  const host = env.TG_HOST?.trim().replace(/\/+$/, "");
  const graph = env.TG_GRAPH?.trim() || "ScamLens";
  const secret = env.TG_SECRET?.trim();
  if (!host || !secret || !GRAPH_NAME.test(graph)) return null;
  return { host: /^https?:\/\//.test(host) ? host : `https://${host}`, graph, secret };
}

/** TigerGraph when TG_HOST/TG_SECRET are set, else the Postgres recursive-CTE fallback. */
export function graphBackend({ env, db }: GraphDeps): GraphBackend | null {
  const tg = tgConfig(env);
  if (tg) return tigerGraphBackend(tg);
  return db ? postgresBackend(db) : null;
}

export function hubMax(env: Record<string, string | undefined>): number {
  return Math.floor(positiveIntEnv(env.GRAPH_HUB_MAX, DEFAULT_HUB_MAX));
}

/** Single entry point for link queries. Hub nodes (high-degree or exchange addresses) never link unrelated people. */
export async function findLinks<Q extends LinkQuery>(q: Q, deps: GraphDeps, backend = graphBackend(deps)): Promise<LinkResult<Q>> {
  if (!backend) throw new Error("no graph backend configured");
  return backend.run(q, hubMax(deps.env));
}
