// Redacts an optional case excerpt before it is shown back and stored. Pure and client-safe: the browser runs the
// same function to show the exact text that will be saved, and the server runs it again on what it receives.
import type { IdentifierType } from "../extract/types";
import { extractIdentifiers } from "../identifiers";
import { MAX_EXCERPT_CHARS } from "./schema";

const TOKEN: Record<IdentifierType, string> = {
  upi: "[UPI]",
  phone: "[PHONE]",
  evm: "[WALLET]",
  tron: "[WALLET]",
  btc: "[WALLET]",
  telegram: "[HANDLE]",
  email: "[EMAIL]",
  domain: "[LINK]",
};

// A URL ends before trailing punctuation, so "see https://x.example, then" keeps its comma.
const URL_RE = /\b(?:https?:\/\/|www\.)\S*?(?=[.,;:!?)\]}'"]*(?:\s|$))/gi;
const TME_RE = /\b(?:t\.me|telegram\.me)\/[A-Za-z0-9_]+/gi;
const DIGITS_RE = /\d{4,}/g;

/**
 * Replaces every identifier the extractor finds with a type token, every URL with [LINK], every run of 4 or more
 * digits with [NUMBER], and caps the result at 500 characters. Idempotent: redacting a redacted text changes nothing.
 */
export function redactExcerpt(input: string): string {
  let s = input.replace(/\r\n?/g, "\n").replace(URL_RE, "[LINK]").replace(TME_RE, "[HANDLE]");
  // Replace from the end so earlier offsets stay valid.
  for (const id of [...extractIdentifiers(s)].sort((a, b) => b.start - a.start)) {
    s = s.slice(0, id.start) + TOKEN[id.type] + s.slice(id.end);
  }
  s = s.replace(DIGITS_RE, "[NUMBER]");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (s.length > MAX_EXCERPT_CHARS) s = s.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd() + "…";
  return s;
}
