// Synthetic demo/test data. Every row is written with synthetic=true and every
// identifier is fabricated (zz_demo / okdemo / hash-derived wallets).
import { createHash, createHmac } from "node:crypto";
import type { IdentifierType } from "../extract/types";
import { identifierHash, maskIdentifier } from "../reports/privacy";
import { canonicalIdentifier, submitReport, type ReportsConfig } from "../reports/service";
import type { ReportRequest } from "../reports/schema";

export { DEMO_LABEL as SYNTHETIC_WATERMARK } from "../demo";

const fakeEvm = (label: string) => "0x" + createHash("sha256").update(`scamlens-synthetic:${label}`).digest("hex").slice(0, 40);

export const SEED_IDS = {
  u1: "zzdemo.refund@okdemo",
  u2: "zzdemo.kyc@okdemo",
  t1: "@zz_demo_alpha",
  t2: "@zz_demo_bravo",
  t3: "@zz_demo_charlie",
  t9: "@zz_demo_exch_user1",
  t10: "@zz_demo_exch_user2",
  main: fakeEvm("collection-wallet"),
  ex: fakeEvm("exchange-hot-wallet"),
  w2: fakeEvm("victim-wallet-2"),
  w3: fakeEvm("mule-wallet-3"),
  w4: fakeEvm("wallet-4"),
  f1: fakeEvm("flagged-1"),
  f2: fakeEvm("flagged-2"),
} as const;
type Key = keyof typeof SEED_IDS;

const typeOf = (k: Key): IdentifierType => (k.startsWith("u") ? "upi" : k.startsWith("t") ? "telegram" : "evm");

// [reporter #, category, identifiers]
const REPORTS: [number, ReportRequest["category"], Key[]][] = [
  [1, "investment", ["u1", "main"]],
  [2, "investment", ["main", "t1"]],
  [3, "task_job", ["main", "t2"]],
  [4, "investment", ["t3", "main"]],
  [5, "investment", ["u1"]],
  [6, "other", ["u2", "ex"]],
  [7, "other", ["ex", "t9"]],
  [8, "kyc_refund", ["u1", "t1"]], // direct UPI-Telegram link: Q1 must not report t1 for u1
  [9, "other", ["ex", "t10"]],
];
const PAYMENTS: [Key, Key][] = [
  ["w2", "w3"],
  ["w3", "f1"],
  ["w2", "ex"],
  ["ex", "f2"], // via an exchange: must be ignored by Q2
  ["w4", "f1"],
];
const FLAGGED: Key[] = ["f1", "f2"];
const EXCHANGES: Key[] = ["ex"];

export interface SeedNode {
  key: Key;
  type: IdentifierType;
  value: string;
  hash: string;
  display: string;
}
export interface Scenario {
  nodes: Record<Key, SeedNode>;
  reports: { reporter: number; items: SeedNode[] }[];
  payments: [SeedNode, SeedNode][];
  flagged: Set<string>;
  exchanges: Set<string>;
}

export function buildScenario(pepper: string): Scenario {
  const nodes = {} as Record<Key, SeedNode>;
  for (const key of Object.keys(SEED_IDS) as Key[]) {
    const id = canonicalIdentifier(typeOf(key), SEED_IDS[key]);
    if (!id) throw new Error(`seed identifier ${key} failed validation`);
    nodes[key] = { key, type: id.type, value: id.value, hash: identifierHash(pepper, id.type, id.value), display: maskIdentifier(id.type, id.value) };
  }
  return {
    nodes,
    reports: REPORTS.map(([reporter, , keys]) => ({ reporter, items: keys.map((k) => nodes[k]) })),
    payments: PAYMENTS.map(([a, b]) => [nodes[a], nodes[b]]),
    flagged: new Set(FLAGGED.map((k) => nodes[k].hash)),
    exchanges: new Set(EXCHANGES.map((k) => nodes[k].hash)),
  };
}

export async function seedSynthetic(cfg: ReportsConfig): Promise<Scenario> {
  const s = buildScenario(cfg.pepper);
  for (const [reporter, category, keys] of REPORTS) {
    const fp = createHmac("sha256", cfg.pepper).update(`synthetic-reporter-${reporter}`).digest("hex");
    const req: ReportRequest = { identifiers: keys.map((k) => ({ type: typeOf(k), value: SEED_IDS[k] })), category, consent: true };
    const r = await submitReport(req, fp, cfg, true);
    if (!r.ok) throw new Error(`seed report ${reporter} rejected: ${r.reason}`);
  }
  for (const [a, b] of s.payments) {
    await cfg.db.call("add_payment_edge", {
      p_src: a.hash, p_src_display: a.display, p_dst: b.hash, p_dst_display: b.display,
      p_evidence: `Synthetic on-chain transfer ${a.display} -> ${b.display}`, p_synthetic: true,
    });
  }
  for (const k of FLAGGED) {
    await cfg.db.call("add_flagged", { p_hash: s.nodes[k].hash, p_display: s.nodes[k].display, p_source: "synthetic flag (demo)", p_synthetic: true });
  }
  for (const k of EXCHANGES) {
    await cfg.db.call("add_exchange", { p_hash: s.nodes[k].hash, p_label: "Synthetic exchange hot wallet", p_synthetic: true });
  }
  return s;
}
