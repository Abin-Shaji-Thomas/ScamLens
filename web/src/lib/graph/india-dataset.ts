// The Indian synthetic dataset (eval/india-cases.json): 56 labelled cases in 10 campaigns modelled on publicly
// reported scam types (docs/DATASET.md). Every row is synthetic=true; every identifier is fabricated. Seeding is
// idempotent: submission ids, delete codes and fingerprints are derived from the case ids, so a re-run rewrites the
// same rows. Removal touches only rows written for these case ids and hashes.
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deleteCodeHash } from "../cases/delete-code";
import { submitCase } from "../cases/service";
import type { CaseRequest } from "../cases/schema";
import type { IdentifierType } from "../extract/types";
import { identifierHash, fingerprintHash, maskIdentifier } from "../reports/privacy";
import type { SqlRunner } from "../reports/db";
import { canonicalIdentifier, type ReportsConfig } from "../reports/service";
import type { ReportRequest } from "../reports/schema";
import { runRules } from "../signals/regex";

export const INDIA_DATASET_PATH = join(import.meta.dirname, "..", "..", "..", "..", "eval", "india-cases.json");

export interface IndiaCase {
  id: string;
  campaign: number;
  category: ReportRequest["category"];
  channel: CaseRequest["channel"];
  lossBand: CaseRequest["lossBand"];
  month: string;
  reporterIp: string;
  identifiers: { type: IdentifierType; value: string }[];
  text: string;
}
export interface IndiaDataset {
  campaigns: Record<string, string>;
  payments: [string, string][];
  flagged: string[];
  exchanges: string[];
  contested: string[];
  cases: IndiaCase[];
}

export const loadIndiaDataset = (path = INDIA_DATASET_PATH): IndiaDataset => JSON.parse(readFileSync(path, "utf8")) as IndiaDataset;

/** Deterministic UUID (version-4 shape) from a case id, so re-runs reuse the same submission. */
export function datasetUuid(id: string): string {
  const h = createHash("sha256").update(`scamlens-india-dataset:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** Deterministic delete code per case (keyed with the pepper, so only this script can derive it). */
export function datasetDeleteCode(pepper: string, id: string): string {
  return createHmac("sha256", pepper).update(`india-dataset-delete:${id}`).digest("hex").slice(0, 32).match(/.{4}/g)!.join("-");
}
const evm = (v: string) => canonicalIdentifier("evm", v)!;

export interface SeedCounts {
  cases: number;
  caseRows: number;
  reports: number;
  identifiers: number;
  payments: number;
  flagged: number;
  exchanges: number;
  contested: number;
  migration004: boolean;
}

/** Counts only, no writes (the --dry-run default). */
export function planCounts(ds: IndiaDataset): Omit<SeedCounts, "caseRows" | "migration004"> {
  const ids = new Set(ds.cases.flatMap((c) => c.identifiers.map((i) => `${i.type}:${i.value}`)));
  return {
    cases: ds.cases.length,
    reports: ds.cases.reduce((n, c) => n + c.identifiers.length, 0),
    identifiers: ids.size,
    payments: ds.payments.length,
    flagged: ds.flagged.length,
    exchanges: ds.exchanges.length,
    contested: ds.contested.length,
  };
}

/** True when migration 004 is in the database (the function probe has no side effects). */
export async function hasCases(cfg: ReportsConfig): Promise<boolean> {
  try {
    await cfg.db.call("feedback_counts", { p_hashes: [] });
    return true;
  } catch {
    return false;
  }
}

/** Writes the dataset. With migration 004: one case per row (old row deleted by its code first); without: reports only. */
export async function seedIndia(cfg: ReportsConfig, ds: IndiaDataset = loadIndiaDataset()): Promise<SeedCounts> {
  const withCases = await hasCases(cfg);
  let caseRows = 0;
  let reports = 0;
  for (const c of ds.cases) {
    const fp = fingerprintHash(cfg.pepper, c.reporterIp);
    const submissionId = datasetUuid(c.id);
    const ruleIds = [...new Set(runRules(c.text).map((s) => s.rule_id))];
    const now = new Date(`${c.month}-15T12:00:00Z`);
    if (withCases) {
      const code = datasetDeleteCode(cfg.pepper, c.id);
      await cfg.db.call("delete_case_by_code", { p_delete_hash: deleteCodeHash(cfg.pepper, code), p_remove_reports: false });
      const r = await submitCase(
        { identifiers: c.identifiers, category: c.category, channel: c.channel, lossBand: c.lossBand, ruleIds, excerptConsent: false, consent: true },
        fp,
        { ...cfg, maxPerDay: 1000 },
        { synthetic: true, now, deleteCode: code, submissionId },
      );
      if (!r.ok) throw new Error(`case ${c.id} rejected: ${r.reason}`);
      caseRows++;
      reports += r.stored;
    } else {
      const items = c.identifiers.map((ref) => {
        const id = canonicalIdentifier(ref.type, ref.value);
        if (!id) throw new Error(`case ${c.id}: invalid ${ref.type} ${ref.value}`);
        return { type: id.type, hash: identifierHash(cfg.pepper, id.type, id.value), display: maskIdentifier(id.type, id.value) };
      });
      const [row] = await cfg.db.call<{ ok: boolean; reason: string | null; stored: number }>("submit_report", {
        p_items: items, p_fingerprint: fp, p_category: c.category, p_submission: submissionId, p_synthetic: true, p_max_per_day: 1000,
      });
      if (!row?.ok) throw new Error(`case ${c.id} rejected: ${row?.reason}`);
      reports += row.stored;
    }
  }
  for (const [a, b] of ds.payments) {
    const x = evm(a), y = evm(b);
    const dx = maskIdentifier("evm", x.value), dy = maskIdentifier("evm", y.value);
    await cfg.db.call("add_payment_edge", {
      p_src: identifierHash(cfg.pepper, "evm", x.value), p_src_display: dx, p_dst: identifierHash(cfg.pepper, "evm", y.value), p_dst_display: dy,
      p_evidence: `Synthetic on-chain transfer ${dx} -> ${dy} (Illustrative demo data)`, p_synthetic: true,
    });
  }
  for (const f of ds.flagged) {
    const x = evm(f);
    await cfg.db.call("add_flagged", { p_hash: identifierHash(cfg.pepper, "evm", x.value), p_display: maskIdentifier("evm", x.value), p_source: "synthetic flag (demo)", p_synthetic: true });
  }
  for (const e of ds.exchanges) {
    await cfg.db.call("add_exchange", { p_hash: identifierHash(cfg.pepper, "evm", evm(e).value), p_label: "Synthetic exchange-style hot wallet (demo)", p_synthetic: true });
  }
  let contested = 0;
  for (const v of ds.contested) {
    const id = canonicalIdentifier("upi", v)!;
    const hash = identifierHash(cfg.pepper, "upi", id.value);
    const [state] = await cfg.db.call<{ contested: boolean }>("reported_counts_v2", { p_hashes: [hash] }).catch(() => []);
    if (state && !state.contested) {
      await cfg.db.call("contest_identifier_v2", { p_hash: hash, p_reason: "Synthetic dataset: the owner says this is their own shop's UPI ID (Illustrative demo data)." });
    }
    contested++;
  }
  const p = planCounts(ds);
  return { ...p, reports, caseRows, contested, migration004: withCases };
}

/** Every key the dataset wrote: submission ids and identifier hashes. */
export function datasetKeys(pepper: string, ds: IndiaDataset) {
  const hashes = new Set<string>();
  for (const c of ds.cases) for (const i of c.identifiers) hashes.add(identifierHash(pepper, i.type, canonicalIdentifier(i.type, i.value)!.value));
  for (const v of [...ds.flagged, ...ds.exchanges, ...ds.payments.flat()]) hashes.add(identifierHash(pepper, "evm", evm(v).value));
  return { submissions: ds.cases.map((c) => datasetUuid(c.id)), hashes: [...hashes] };
}

/** Removal plan as SQL with parameters; every statement is limited to synthetic rows of this dataset. */
export function removalStatements(pepper: string, ds: IndiaDataset): { sql: string; params: unknown[] }[] {
  const { submissions, hashes } = datasetKeys(pepper, ds);
  const contestedHashes = ds.contested.map((v) => identifierHash(pepper, "upi", canonicalIdentifier("upi", v)!.value));
  return [
    { sql: "delete from cases where synthetic and submission_id = any($1::uuid[])", params: [submissions] },
    { sql: "delete from graph_edges where synthetic and submission_id = any($1::uuid[])", params: [submissions] },
    { sql: "delete from graph_edges where synthetic and relation = 'payment' and src_hash = any($1::text[]) and dst_hash = any($1::text[])", params: [hashes] },
    { sql: "delete from reports where synthetic and submission_id = any($1::uuid[])", params: [submissions] },
    { sql: "delete from flagged_addresses where synthetic and address_hash = any($1::text[])", params: [hashes] },
    { sql: "delete from exchange_addresses where synthetic and address_hash = any($1::text[])", params: [hashes] },
    { sql: "delete from contests where identifier_hash = any($1::text[]) and reason like 'Synthetic dataset:%'", params: [contestedHashes] },
  ];
}

/** Runs the removal on a SQL runner (local Postgres / PGlite). Tables missing before migration 004 are skipped. */
export async function removeIndiaSql(runner: SqlRunner, pepper: string, ds: IndiaDataset = loadIndiaDataset()): Promise<number> {
  let n = 0;
  for (const s of removalStatements(pepper, ds)) {
    try {
      const r = (await runner.query(s.sql, s.params)) as { affectedRows?: number };
      n += r.affectedRows ?? 0;
    } catch (e) {
      if (!/does not exist/.test(String(e))) throw e;
    }
  }
  return n;
}
