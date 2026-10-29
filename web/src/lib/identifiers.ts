// Identifier extractor: the trust anchor. AI may propose identifiers, but only
// what this code validates (checksum or strict format) is ever looked up.
import { extractBtc, extractEvm, extractTron } from "./extract/crypto";
import { extractDomains, extractPhone, extractTelegram, extractUpiAndEmail } from "./extract/contact";
import type { Identifier, IdentifierType } from "./extract/types";

export { Identifier, IdentifierType, IDENTIFIER_TYPES } from "./extract/types";

// Tie-break for overlapping matches of equal length (lower index wins).
const PRIORITY: readonly IdentifierType[] = ["evm", "tron", "btc", "email", "upi", "telegram", "domain", "phone"];

function overlaps(a: Identifier, b: Identifier): boolean {
  return a.start < b.end && b.start < a.end;
}

export function extractIdentifiers(text: string): Identifier[] {
  const candidates = [
    ...extractEvm(text),
    ...extractTron(text),
    ...extractBtc(text),
    ...extractUpiAndEmail(text),
    ...extractTelegram(text),
    ...extractDomains(text),
    ...extractPhone(text),
  ].sort((a, b) => b.end - b.start - (a.end - a.start) || PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));

  const kept: Identifier[] = [];
  for (const c of candidates) if (!kept.some((k) => overlaps(k, c))) kept.push(c);
  return kept.sort((a, b) => a.start - b.start);
}

/** One entry per distinct (type, value), keeping the first occurrence. */
export function uniqueIdentifiers(ids: Identifier[]): Identifier[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = `${id.type}:${id.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
