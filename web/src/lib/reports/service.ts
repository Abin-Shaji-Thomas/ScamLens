import { randomUUID } from "node:crypto";
import { positiveIntEnv } from "../env";
import { DEFAULT_REPORTS_MAX_PER_DAY } from "../limits";
import type { Identifier, IdentifierType } from "../extract/types";
import { extractIdentifiers } from "../identifiers";
import { dbFromEnv, type Db } from "./db";
import { identifierHash, maskIdentifier, MIN_PEPPER_LENGTH, reporterKey } from "./privacy";
import type { ContestRequest, ReportedEntry, ReportedTier, ReportRequest } from "./schema";

export interface ReportsConfig {
  db: Db;
  pepper: string;
  maxPerDay: number;
}

export function reportsConfig(env: Record<string, string | undefined>, db: Db | null = dbFromEnv(env)): ReportsConfig | string {
  if (!db) return "reports database not configured";
  const pepper = env.REPORT_HASH_PEPPER ?? "";
  if (pepper.length < MIN_PEPPER_LENGTH) return "REPORT_HASH_PEPPER not configured";
  return { db, pepper, maxPerDay: positiveIntEnv(env.REPORTS_MAX_PER_DAY, DEFAULT_REPORTS_MAX_PER_DAY) };
}

/** Re-validate a client-supplied identifier with the extractor: it must be exactly one valid identifier of that type. */
export function canonicalIdentifier(type: IdentifierType, value: string): Identifier | null {
  const found = extractIdentifiers(value);
  return found.length === 1 && found[0].type === type && found[0].raw === value.trim() ? found[0] : null;
}

export async function submitReport(req: ReportRequest, fingerprint: string, cfg: ReportsConfig, synthetic = false) {
  const items = [];
  for (const ref of req.identifiers) {
    const id = canonicalIdentifier(ref.type, ref.value);
    if (!id) return { ok: false as const, reason: `invalid ${ref.type} identifier` };
    items.push({ type: id.type, hash: identifierHash(cfg.pepper, id.type, id.value), display: maskIdentifier(id.type, id.value) });
  }
  const submissionId = randomUUID();
  const [row] = await cfg.db.call<{ ok: boolean; reason: string | null; stored: number }>("submit_report", {
    p_items: items,
    p_fingerprint: fingerprint,
    p_category: req.category,
    p_submission: submissionId,
    p_synthetic: synthetic,
    p_max_per_day: cfg.maxPerDay,
  });
  return row.ok
    ? {
        ok: true as const,
        stored: row.stored,
        submissionId,
        reporterKey: reporterKey(fingerprint),
        nodes: items.map((i) => ({ hash: i.hash, type: i.type, display: i.display })),
      }
    : { ok: false as const, reason: row.reason ?? "rejected" };
}

type CountRow = {
  identifier_hash: string;
  identifier_type: IdentifierType;
  identifier_display: string;
  reporters: number;
  categories: string[];
  first_reported: string | Date;
  last_reported: string | Date;
  synthetic: boolean;
  contested?: boolean;
};

/** Reported tier for the identifiers in a check. DB failure is "unavailable", never "no reports". */
export async function reportedFor(ids: Identifier[], cfg: ReportsConfig | string): Promise<ReportedTier> {
  if (typeof cfg === "string") return { status: "unavailable", entries: [], reason: cfg };
  if (!ids.length) return { status: "ok", entries: [] };
  try {
    const hashes = ids.map((i) => identifierHash(cfg.pepper, i.type, i.value));
    // Migration 002 adds reported_counts_v2 (contested entries visible). Before it, fall back to the old
    // function, which hides contested entries; the response says which policy applied.
    let rows: CountRow[];
    let contestPolicy: "visible" | "legacy_hidden" = "visible";
    try {
      rows = await cfg.db.call<CountRow>("reported_counts_v2", { p_hashes: hashes });
    } catch {
      rows = await cfg.db.call<CountRow>("reported_counts", { p_hashes: hashes });
      contestPolicy = "legacy_hidden";
    }
    const entries: ReportedEntry[] = rows.map((r) => ({
      type: r.identifier_type,
      display: r.identifier_display,
      reporters: r.reporters,
      categories: r.categories,
      firstReported: new Date(r.first_reported).toISOString().slice(0, 10),
      lastReported: new Date(r.last_reported).toISOString().slice(0, 10),
      synthetic: r.synthetic,
      contested: Boolean(r.contested),
    }));
    return { status: "ok", entries, contestPolicy };
  } catch {
    return { status: "unavailable", entries: [], reason: "reports database error" };
  }
}

/**
 * Records a contest. The entry stays visible, labelled "Contested, under review" (migration 002).
 * On a database without migration 002 this refuses instead of calling the old function, which would
 * hide the evidence from everyone. The reason is stored for the moderator only and never returned.
 */
export async function contestIdentifier(req: ContestRequest, cfg: ReportsConfig) {
  const id = canonicalIdentifier(req.identifier.type, req.identifier.value);
  if (!id) return { ok: false as const, reason: "invalid identifier" };
  try {
    const [row] = await cfg.db.call<{ updated: number }>("contest_identifier_v2", {
      p_hash: identifierHash(cfg.pepper, id.type, id.value),
      p_reason: req.reason,
    });
    return { ok: true as const, updated: row?.updated ?? 0 };
  } catch {
    return { ok: false as const, reason: "contest_unavailable" as const };
  }
}

/** Client IP as set by Vercel's edge (x-forwarded-for / x-real-ip are overwritten there, not client-controlled). */
export function requestIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
