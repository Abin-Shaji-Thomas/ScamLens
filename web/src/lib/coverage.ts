// Coverage ledger ("What was checked"): built only from a real check result, never typed per run.
// Client-safe: no list data or server-only imports. It never says "clean" or "safe": a source was checked,
// not applicable, unavailable, skipped because of a limit, or (for the AI helper) off.
import type { CheckResponse } from "./api-schema";
import type { IdentifierType } from "./extract/types";
import { RULES } from "./signals/rules";
import { MAX_DOMAINS, type SourceId, type SourceResult } from "./verified/types";

export type CoverageStatus = "checked" | "not applicable" | "unavailable" | "skipped (limit)" | "off" | "not looked up (press Show links)";

/** What the page knows about the link graph for this result: null = no graph lookup has happened yet. */
export type GraphCoverage = { status: "ok" | "unavailable"; backend?: string; elapsedMs?: number } | null;

/** Identifier types the link graph can be asked about from the result card (GraphPanel). */
export const GRAPH_LOOKUP_TYPES: readonly IdentifierType[] = ["upi", "evm"];

export interface CoverageRow {
  id: SourceId | "reports" | "rules" | "ai" | "graph";
  name: string;
  covers: string;
  status: CoverageStatus;
  /** List date or check time, taken from the result (never typed). */
  when?: string;
  detail?: string;
}

export interface Coverage {
  rows: CoverageRow[];
  notChecked: string[];
}

// What each source can cover, from the code in verified/index.ts (tasksFor) and the source modules.
const SOURCES: { id: SourceId; name: string; covers: string; types: IdentifierType[] }[] = [
  { id: "ofac", name: "OFAC SDN list", covers: "Crypto addresses on the US sanctions list", types: ["evm", "tron", "btc"] },
  { id: "scamsniffer", name: "ScamSniffer open blacklist", covers: "Scam-linked EVM wallets (public copy about 7 days delayed)", types: ["evm"] },
  { id: "goplus", name: "GoPlus address security", covers: "Risk flags for EVM and TRON wallets", types: ["evm", "tron"] },
  { id: "goplus_phishing", name: "GoPlus phishing sites", covers: "Website domains on GoPlus's phishing-site list", types: ["domain"] },
  { id: "etherscan", name: "Etherscan V2", covers: "On-chain history of the first EVM wallet", types: ["evm"] },
  { id: "trongrid", name: "TronGrid", covers: "On-chain history of TRON wallets", types: ["tron"] },
];

const NOT_ON_PLAN = /not included in the Etherscan free API plan/;
const isSkip = (r: SourceResult) => r.status === "unavailable" && (r.reason ?? "").startsWith("skipped");
const isNotOnPlan = (r: SourceResult) => r.status === "unavailable" && NOT_ON_PLAN.test(r.reason ?? "");
const minute = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

const WALLET_NAMES: Partial<Record<IdentifierType, string>> = { evm: "EVM wallet", tron: "TRON wallet", btc: "Bitcoin address" };

const TYPE_NAMES: Partial<Record<IdentifierType, string>> = {
  upi: "UPI IDs",
  phone: "Phone numbers",
  telegram: "Telegram handles",
  email: "Email addresses",
};

function sourceRow(s: (typeof SOURCES)[number], r: CheckResponse): CoverageRow {
  const base = { id: s.id, name: s.name, covers: s.covers };
  const rows = r.verified.filter((v) => v.source === s.id && !isNotOnPlan(v));
  if (!r.identifiers.some((i) => s.types.includes(i.type)) || rows.length === 0) return { ...base, status: "not applicable" };
  const done = rows.filter((v) => v.status !== "unavailable");
  const skippedWallets = new Set(rows.filter(isSkip).map((v) => v.identifier.value)).size;
  const skipNote = skippedWallets ? `${skippedWallets} more wallet(s) skipped because of the rate limit` : "";
  const listDate = done.find((v) => v.dataAsOf)?.dataAsOf;
  if (done.length) {
    const chains = s.id === "etherscan" ? [...new Set(done.map((v) => v.sourceName.replace(/^Etherscan V2 \((.*)\)$/, "$1")))] : [];
    const failed = rows.filter((v) => v.status === "unavailable" && !isSkip(v)).length;
    const parts = [chains.length ? `chains: ${chains.join(", ")}` : "", failed ? `${failed} lookup(s) unavailable` : "", skipNote].filter(Boolean);
    return {
      ...base,
      status: "checked",
      when: listDate ? `list dated ${listDate}` : `checked ${minute(done[0].checkedAt)}`,
      detail: parts.join("; ") || undefined,
    };
  }
  if (rows.every(isSkip)) return { ...base, status: "skipped (limit)", detail: rows[0].reason };
  const why = rows.find((v) => !isSkip(v))?.reason;
  return { ...base, status: "unavailable", when: `tried ${minute(rows[0].checkedAt)}`, detail: [why, skipNote].filter(Boolean).join("; ") };
}

/** The "Link graph" row; only added when the page passes the graph state (the signed receipt never does). */
function graphRow(r: CheckResponse, graph: GraphCoverage): CoverageRow {
  const base = { id: "graph" as const, name: "Link graph", covers: "Links between identifiers in community reports and on-chain transfers" };
  if (!r.identifiers.some((i) => GRAPH_LOOKUP_TYPES.includes(i.type))) return { ...base, status: "not applicable" };
  if (!graph) return { ...base, status: "not looked up (press Show links)" };
  if (graph.status === "unavailable") return { ...base, status: "unavailable", detail: graph.backend };
  return { ...base, status: "checked", when: `${graph.backend ?? "graph"}${graph.elapsedMs !== undefined ? `, ${graph.elapsedMs} ms` : ""}` };
}

export function buildCoverage(r: CheckResponse, opts?: { graph: GraphCoverage }): Coverage {
  const rows: CoverageRow[] = SOURCES.map((s) => sourceRow(s, r));
  rows.push({
    id: "reports",
    name: "ScamLens community reports",
    covers: "Every identifier type; shown only after independent reporters",
    ...(r.identifiers.length === 0
      ? { status: "not applicable" as const }
      : r.reported.status === "ok"
        ? { status: "checked" as const, when: `checked ${minute(r.checkedAt)}` }
        : { status: "unavailable" as const, detail: r.reported.reason }),
  });
  if (opts) rows.push(graphRow(r, opts.graph));
  rows.push({ id: "rules", name: "Pattern rules", covers: `${RULES.length} fixed rules on your text`, status: "checked", when: `checked ${minute(r.checkedAt)}` });
  if (r.ai.status !== "off") {
    rows.push({
      id: "ai",
      name: "AI helper",
      covers: "May only point at the same rules, with exact quotes",
      status: r.ai.status === "ok" ? "checked" : "unavailable",
      detail: r.ai.status === "ok" ? undefined : r.ai.reason,
    });
  }

  const notChecked: string[] = [];
  const types = new Set(r.identifiers.map((i) => i.type));
  for (const [t, label] of Object.entries(TYPE_NAMES) as [IdentifierType, string][]) {
    if (types.has(t)) notChecked.push(`${label} have no public database here; only community reports are used.`);
  }
  const domains = r.identifiers.filter((i) => i.type === "domain");
  const lookedUp = new Set(r.verified.filter((v) => v.identifier.type === "domain").map((v) => v.identifier.value));
  const missed = domains.filter((d) => !lookedUp.has(d.value)).length;
  if (missed) notChecked.push(`${missed} website domain(s) were not looked up (only the first ${MAX_DOMAINS} are).`);
  if (domains.length) notChecked.push("Website domains were checked only against GoPlus's phishing-site list, not other blocklists.");
  for (const id of r.identifiers.filter((i) => i.type === "evm" || i.type === "tron" || i.type === "btc")) {
    const ran = new Set(r.verified.filter((v) => v.identifier.value === id.value && !isNotOnPlan(v)).map((v) => v.source));
    // Wallet sources only: a domain-only source (GoPlus phishing sites) never applies to a wallet.
    const missing = SOURCES.filter((s) => s.types.some((t) => t !== "domain") && !ran.has(s.id)).map((s) => s.name);
    if (ran.size && missing.length) {
      notChecked.push(`${WALLET_NAMES[id.type]} ${id.value.slice(0, 10)}...: not looked up in ${missing.join(", ")}.`);
    }
  }
  const offPlan = [...new Set(r.verified.filter(isNotOnPlan).map((v) => v.sourceName.replace(/^Etherscan V2 \((.*)\)$/, "$1")))];
  if (offPlan.length) notChecked.push(`Etherscan history on ${offPlan.join(", ")} is not enabled on this plan.`);
  return { rows, notChecked };
}
