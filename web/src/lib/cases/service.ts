// Contributed cases and feedback (migration 004). Every database failure, including a database that predates 004,
// becomes "unavailable" for writes and an empty, labelled answer for reads; checks never depend on these tables.
import { randomUUID } from "node:crypto";
import type { Identifier, IdentifierType } from "../extract/types";
import { identifierHash, maskIdentifier, reporterKey } from "../reports/privacy";
import { canonicalIdentifier, type ReportsConfig } from "../reports/service";
import { RULES } from "../signals/rules";
import { deleteCodeHash, isWellFormedDeleteCode, newDeleteCode } from "./delete-code";
import { redactExcerpt } from "./redact";
import type { CaseRequest, DeleteCaseRequest, FeedbackCount, FeedbackRequest } from "./schema";

const KNOWN_RULES = new Set(RULES.map((r) => r.id));
export const unknownRuleIds = (ids: string[]) => ids.filter((id) => !KNOWN_RULES.has(id));

/** Server-computed month of a case: YYYY-MM in UTC, never a full date. */
export const caseMonth = (now: Date) => now.toISOString().slice(0, 7);

export type CaseResult =
  | { ok: true; stored: number; caseId: string; deleteCode: string; submissionId: string; reporterKey: string; nodes: { hash: string; type: IdentifierType; display: string }[] }
  | { ok: false; reason: string };

export async function submitCase(
  req: CaseRequest,
  fingerprint: string,
  cfg: ReportsConfig,
  opts: { synthetic?: boolean; now?: Date; deleteCode?: string; submissionId?: string } = {},
): Promise<CaseResult> {
  const bad = unknownRuleIds(req.ruleIds);
  if (bad.length) return { ok: false, reason: "unknown rule id" };
  const items = [];
  for (const ref of req.identifiers) {
    const id = canonicalIdentifier(ref.type, ref.value);
    if (!id) return { ok: false, reason: `invalid ${ref.type} identifier` };
    items.push({ type: id.type, hash: identifierHash(cfg.pepper, id.type, id.value), display: maskIdentifier(id.type, id.value) });
  }
  const excerpt = req.excerpt?.trim() && req.excerptConsent ? redactExcerpt(req.excerpt) : null;
  const deleteCode = opts.deleteCode ?? newDeleteCode();
  const submissionId = opts.submissionId ?? randomUUID();
  try {
    const [row] = await cfg.db.call<{ ok: boolean; reason: string | null; stored: number; case_id: string | null }>("submit_case", {
      p_items: items,
      p_fingerprint: fingerprint,
      p_category: req.category,
      p_submission: submissionId,
      p_channel: req.channel,
      p_loss_band: req.lossBand,
      p_month: caseMonth(opts.now ?? new Date()),
      p_rule_ids: [...new Set(req.ruleIds)],
      p_excerpt: excerpt,
      p_delete_hash: deleteCodeHash(cfg.pepper, deleteCode),
      p_synthetic: opts.synthetic ?? false,
      p_max_per_day: cfg.maxPerDay,
    });
    if (!row?.ok || !row.case_id) return { ok: false, reason: row?.reason ?? "rejected" };
    return { ok: true, stored: row.stored, caseId: row.case_id, deleteCode, submissionId, reporterKey: reporterKey(fingerprint), nodes: items };
  } catch {
    return { ok: false, reason: "cases_unavailable" };
  }
}

export async function deleteCase(req: DeleteCaseRequest, cfg: ReportsConfig): Promise<{ ok: true; deleted: number; reportsRemoved: number } | { ok: false; reason: string }> {
  if (!isWellFormedDeleteCode(req.code)) return { ok: true, deleted: 0, reportsRemoved: 0 };
  try {
    const [row] = await cfg.db.call<{ deleted: number; reports_removed: number }>("delete_case_by_code", {
      p_delete_hash: deleteCodeHash(cfg.pepper, req.code),
      p_remove_reports: req.removeReports,
    });
    return { ok: true, deleted: row?.deleted ?? 0, reportsRemoved: row?.reports_removed ?? 0 };
  } catch {
    return { ok: false, reason: "cases_unavailable" };
  }
}

/** Key for feedback on a message without identifiers: the sorted rule ids that fired. */
export const rulesKey = (ruleIds: string[]) => `rules:${[...new Set(ruleIds)].sort().join(",") || "none"}`;

export async function submitFeedback(req: FeedbackRequest, fingerprint: string, cfg: ReportsConfig): Promise<{ ok: true; stored: number } | { ok: false; reason: string }> {
  if (unknownRuleIds(req.ruleIds).length) return { ok: false, reason: "unknown rule id" };
  const hashes: string[] = [];
  for (const ref of req.identifiers) {
    const id = canonicalIdentifier(ref.type, ref.value);
    if (!id) return { ok: false, reason: `invalid ${ref.type} identifier` };
    hashes.push(identifierHash(cfg.pepper, id.type, id.value));
  }
  if (!hashes.length) hashes.push(rulesKey(req.ruleIds));
  try {
    const [row] = await cfg.db.call<{ stored: number }>("submit_feedback", {
      p_hashes: [...new Set(hashes)],
      p_fingerprint: fingerprint,
      p_verdict: req.verdict,
      p_reasons: [...new Set(req.reasons)],
      p_rule_ids: [...new Set(req.ruleIds)],
    });
    return { ok: true, stored: row?.stored ?? 0 };
  } catch {
    return { ok: false, reason: "cases_unavailable" };
  }
}

/** Display-only feedback counts for the identifiers in a check; never changes a level. Empty when unavailable. */
export async function feedbackFor(ids: Identifier[], cfg: ReportsConfig | string): Promise<{ status: "ok" | "unavailable"; entries: FeedbackCount[] }> {
  if (typeof cfg === "string" || !ids.length) return { status: typeof cfg === "string" ? "unavailable" : "ok", entries: [] };
  const byHash = new Map(ids.map((i) => [identifierHash(cfg.pepper, i.type, i.value), maskIdentifier(i.type, i.value)]));
  try {
    const rows = await cfg.db.call<{ identifier_hash: string; scam: number; genuine: number; unsure: number; genuine_reasons: string[] }>("feedback_counts", {
      p_hashes: [...byHash.keys()],
    });
    return {
      status: "ok",
      entries: rows.map((r) => ({
        display: byHash.get(r.identifier_hash) ?? "",
        scam: r.scam,
        genuine: r.genuine,
        unsure: r.unsure,
        genuineReasons: (r.genuine_reasons ?? []) as FeedbackCount["genuineReasons"],
      })),
    };
  } catch {
    return { status: "unavailable", entries: [] };
  }
}
