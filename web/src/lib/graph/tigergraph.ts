// TigerGraph Savanna REST client. NOTE: written against TigerGraph 4.x docs
// (POST /gsql/v1/tokens, GET /restpp/query/{graph}/{query}) but NOT yet exercised
// against a live instance: no TG_HOST was available when this was built.
import { z } from "zod";
import { Q1Row, Q2Row, Q3Row, Q4Edge, type GraphBackend, type LinkQuery, type LinkResult } from "./types";

export interface TgConfig {
  host: string; // e.g. https://<id>.i.tgcloud.io
  graph: string;
  secret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const TokenResp = z.object({ token: z.string() });
const QueryResp = z.object({ error: z.boolean().optional(), results: z.array(z.object({ rows: z.array(z.unknown()) })) });

const QUERY_NAMES: Record<LinkQuery["kind"], string> = {
  q1: "q1_upi_wallet_telegram",
  q2: "q2_payment_to_flagged",
  q3: "q3_telegram_clusters",
  q4: "q4_neighbourhood",
};

export function tigerGraphBackend(cfg: TgConfig): GraphBackend {
  const f = cfg.fetch ?? fetch;
  const timeout = cfg.timeoutMs ?? 5000;
  let token: { value: string; at: number } | undefined;

  async function getToken(): Promise<string> {
    if (token && Date.now() - token.at < 50 * 60 * 1000) return token.value;
    const res = await f(`${cfg.host}/gsql/v1/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: cfg.secret }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) throw new Error(`TigerGraph token request failed (HTTP ${res.status})`);
    token = { value: TokenResp.parse(await res.json()).token, at: Date.now() };
    return token.value;
  }

  function params(q: LinkQuery, hubMax: number): URLSearchParams {
    const p = new URLSearchParams({ hub_max: String(hubMax) });
    if (q.kind === "q1") p.set("upi", q.upiHash);
    if (q.kind === "q2") p.set("wallet", q.walletHash);
    if (q.kind === "q3") p.set("min_size", String(q.minSize));
    if (q.kind === "q4") {
      p.set("hash", q.hash);
      p.set("depth", String(q.depth));
    }
    return p;
  }

  return {
    name: "tigergraph",
    async run<Q extends LinkQuery>(q: Q, hubMax: number): Promise<LinkResult<Q>> {
      const url = `${cfg.host}/restpp/query/${encodeURIComponent(cfg.graph)}/${QUERY_NAMES[q.kind]}?${params(q, hubMax)}`;
      const res = await f(url, { headers: { Authorization: `Bearer ${await getToken()}` }, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`TigerGraph query failed (HTTP ${res.status})`);
      const body = QueryResp.parse(await res.json());
      if (body.error) throw new Error("TigerGraph query returned an error");
      const rows = body.results[0]?.rows ?? [];
      const schema = { q1: Q1Row, q2: Q2Row, q3: Q3Row, q4: Q4Edge }[q.kind];
      return z.array(schema).parse(rows) as LinkResult<Q>;
    },
  };
}
