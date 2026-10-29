// Builds TigerGraph upsert payloads (POST /restpp/graph/{graph}) from the Postgres graph tables,
// so both backends hold exactly the same links. Only hashes, masked displays and evidence text move.
import type { IdentifierType } from "../extract/types";
import type { Db } from "../reports/db";
import { VERTEX_TYPE } from "./types";

type EdgeRow = {
  src_hash: string; src_type: IdentifierType; src_display: string;
  dst_hash: string; dst_type: IdentifierType; dst_display: string;
  relation: "co_reported" | "payment"; evidence: string; submission_id: string | null;
  synthetic: boolean; expires_at: string | Date; reporter_key: string | null;
};
type FlagRow = { address_hash: string; source: string };
type ExchangeRow = { address_hash: string };

type Attr = Record<string, { value: string | boolean }>;
export interface UpsertPayload {
  vertices: Record<string, Record<string, Attr>>;
  edges: Record<string, Record<string, Record<string, Record<string, Record<string, Attr>>>>>;
}

export interface GraphNode {
  hash: string;
  type: IdentifierType;
  display: string;
}

export class PayloadBuilder {
  readonly p: UpsertPayload = { vertices: {}, edges: {} };

  node(n: GraphNode, flags: { flagged?: string; exchange?: boolean } = {}) {
    const vt = VERTEX_TYPE[n.type];
    const byId = (this.p.vertices[vt] ??= {});
    const prev = byId[n.hash];
    byId[n.hash] = {
      kind: { value: n.type },
      display: { value: n.display },
      flagged_source: { value: flags.flagged ?? (prev?.flagged_source?.value as string) ?? "" },
      is_exchange: { value: flags.exchange ?? (prev?.is_exchange?.value as boolean) ?? false },
    };
  }

  /** `reporterKey` is the pseudonymous reporter (see reporterKey() in reports/privacy.ts); "" if unknown. */
  report(submissionId: string, evidence: string, synthetic: boolean, members: GraphNode[], reporterKey: string) {
    (this.p.vertices.Report ??= {})[submissionId] = {
      evidence: { value: evidence },
      synthetic: { value: synthetic },
      reporter_key: { value: reporterKey },
    };
    for (const m of members) {
      this.node(m);
      this.edge("Report", submissionId, "MENTIONS", VERTEX_TYPE[m.type], m.hash, {});
    }
  }

  payment(src: GraphNode, dst: GraphNode, evidence: string) {
    this.node(src);
    this.node(dst);
    this.edge("Wallet", src.hash, "PAID", "Wallet", dst.hash, { evidence: { value: evidence } });
  }

  private edge(st: string, sid: string, et: string, tt: string, tid: string, attrs: Attr) {
    ((((this.p.edges[st] ??= {})[sid] ??= {})[et] ??= {})[tt] ??= {})[tid] = attrs;
  }

  counts() {
    const v = Object.values(this.p.vertices).reduce((n, byId) => n + Object.keys(byId).length, 0);
    let e = 0;
    for (const bySrc of Object.values(this.p.edges))
      for (const byEdge of Object.values(bySrc))
        for (const byTarget of Object.values(byEdge)) for (const ids of Object.values(byTarget)) e += Object.keys(ids).length;
    return { vertices: v, edges: e };
  }
}

/** Full export: every active edge, flag and exchange label currently in Postgres. */
export async function buildFullPayload(db: Db, now = new Date()): Promise<PayloadBuilder> {
  const [edges, flagged, exchanges] = await Promise.all([
    db.selectAll<EdgeRow>("graph_edges"),
    db.selectAll<FlagRow>("flagged_addresses"),
    db.selectAll<ExchangeRow>("exchange_addresses"),
  ]);
  const b = new PayloadBuilder();
  const active = edges.filter((e) => new Date(e.expires_at) > now);
  const src = (e: EdgeRow): GraphNode => ({ hash: e.src_hash, type: e.src_type, display: e.src_display });
  const dst = (e: EdgeRow): GraphNode => ({ hash: e.dst_hash, type: e.dst_type, display: e.dst_display });

  // Postgres stores one co_reported row per identifier pair; TigerGraph stores one Report vertex per submission.
  const bySubmission = new Map<string, { evidence: string; synthetic: boolean; reporter: string; members: Map<string, GraphNode> }>();
  for (const e of active.filter((x) => x.relation === "co_reported" && x.submission_id)) {
    const s = bySubmission.get(e.submission_id!) ?? { evidence: e.evidence, synthetic: e.synthetic, reporter: e.reporter_key ?? "", members: new Map() };
    s.members.set(e.src_hash, src(e));
    s.members.set(e.dst_hash, dst(e));
    bySubmission.set(e.submission_id!, s);
  }
  for (const [id, s] of bySubmission) b.report(id, s.evidence, s.synthetic, [...s.members.values()], s.reporter);
  for (const e of active.filter((x) => x.relation === "payment")) b.payment(src(e), dst(e), e.evidence);

  // Flags only apply to wallets that are in the graph; others have no links to show.
  const wallets = b.p.vertices.Wallet ?? {};
  for (const f of flagged) if (wallets[f.address_hash]) wallets[f.address_hash].flagged_source = { value: f.source };
  for (const x of exchanges) if (wallets[x.address_hash]) wallets[x.address_hash].is_exchange = { value: true };
  return b;
}

/** Same evidence text the SQL function submit_report writes, so both backends show identical evidence. */
export function reportEvidence(category: string, at: Date): string {
  return `Named together in one ${category} report on ${at.toISOString().slice(0, 10)}`;
}
