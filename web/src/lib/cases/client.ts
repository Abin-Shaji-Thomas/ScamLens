// Request bodies for the result's "Was this right?" and "add it to the map" panels. Pure and client-safe, so the
// browser and the tests build exactly the same JSON.
import type { CheckResponse } from "../api-schema";
import { redactExcerpt } from "./redact";
import type { CaseRequest, FeedbackRequest } from "./schema";

const MAX_IDS = 10;

/** Rules that counted (not those only in warning or news-style sentences). */
export const countedRuleIds = (r: CheckResponse) => [...new Set(r.suspected.filter((s) => s.context !== "warning").map((s) => s.rule_id))];

/** The identifiers as the person typed them (the server re-validates each one). */
const refs = (r: CheckResponse) =>
  r.identifiers
    .filter((id, i, all) => all.findIndex((x) => x.type === id.type && x.value === id.value) === i)
    .slice(0, MAX_IDS)
    .map((id) => ({ type: id.type, value: id.raw }));

export function feedbackBody(r: CheckResponse, verdict: FeedbackRequest["verdict"], reasons: FeedbackRequest["reasons"]): FeedbackRequest {
  return { identifiers: refs(r), verdict, reasons: [...new Set(reasons)], ruleIds: countedRuleIds(r) };
}

export interface CaseForm {
  category: CaseRequest["category"];
  channel: CaseRequest["channel"];
  lossBand: CaseRequest["lossBand"];
  consent: boolean;
  /** The optional excerpt: only when the person ticked "save an excerpt" and then the second consent. */
  includeExcerpt: boolean;
  excerptConsent: boolean;
}

/** The text that would be saved: exactly what the panel shows before the person ticks the second box. */
export const excerptPreview = (checkedText: string) => redactExcerpt(checkedText);

export function caseBody(r: CheckResponse, checkedText: string, f: CaseForm): CaseRequest {
  const withExcerpt = f.includeExcerpt && f.excerptConsent && checkedText.trim().length > 0;
  return {
    identifiers: refs(r),
    category: f.category,
    channel: f.channel,
    lossBand: f.lossBand,
    ruleIds: countedRuleIds(r),
    ...(withExcerpt ? { excerpt: excerptPreview(checkedText), excerptConsent: true } : { excerptConsent: false }),
    consent: f.consent as true,
  };
}
