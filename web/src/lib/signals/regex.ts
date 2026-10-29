import { RULES } from "./rules";
import type { Signal } from "./types";

const NEGATION = /\b(never|not|don'?t|do not|no one|nobody|won'?t|will never|avoid)\b[^.\n]*$/i;
const NEGATION_WINDOW = 60; // chars to look back; the regex also stops at a sentence break
// Negator immediately before the match, optionally with one word in between ("does not guarantee", "no guaranteed").
const ADJACENT_NEGATION = /\b(not|no|never|cannot|can'?t|don'?t|doesn'?t|without)\s+(\w+\s+)?$/i;
const ADJACENT_WINDOW = 30;
const FOLLOW_WINDOW = 12;

/**
 * De-obfuscated copy of `text` plus, for every character, its index in the original.
 * Handles: zero-width characters (removed), emoji used as separators (become a space), and
 * spaced-out letters such as "O T P", "K.Y.C" or "o-t-p" (separators removed). Matches found on the
 * copy are mapped back, so every quote is still cut from the original text.
 */
export function normalise(text: string): { norm: string; map: number[] } {
  const keep = new Array<boolean>(text.length).fill(true);
  const replace = new Map<number, string>();
  // 3+ single letters separated by one space, dot, dash, underscore, star or newline.
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])\p{L}(?:[ .\-_*\n]\p{L}){2,}(?![\p{L}\p{N}])/gu)) {
    for (let i = m.index + 1; i < m.index + m[0].length; i += 2) keep[i] = false;
  }
  for (const m of text.matchAll(/[​-‍⁠﻿️]/g)) keep[m.index] = false;
  for (const m of text.matchAll(/\p{Extended_Pictographic}/gu)) {
    replace.set(m.index, " ");
    for (let i = 1; i < m[0].length; i++) keep[m.index + i] = false;
  }
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (!keep[i]) continue;
    norm += replace.get(i) ?? text[i];
    map.push(i);
  }
  return { norm, map };
}

/** Up to NEGATION_WINDOW characters before `at`, cut at the last sentence break. */
function sameSentenceBefore(text: string, at: number): string {
  const before = text.slice(Math.max(0, at - NEGATION_WINDOW), at);
  return before.slice(Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"), before.lastIndexOf("\n")) + 1);
}

/** Deterministic pass: every regex hit becomes a signal with exact offsets into the ORIGINAL text. */
export function runRules(text: string): Signal[] {
  const { norm, map } = normalise(text);
  const out: Signal[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      for (const m of norm.matchAll(re)) {
        if (!m[0]) continue;
        const ns = m.index;
        const ne = ns + m[0].length;
        if (rule.negatable && NEGATION.test(norm.slice(Math.max(0, ns - NEGATION_WINDOW), ns))) continue;
        if (rule.negation?.test(sameSentenceBefore(norm, ns))) continue;
        if (rule.adjacentNegation &&ADJACENT_NEGATION.test(norm.slice(Math.max(0, ns - ADJACENT_WINDOW), ns))) continue;
        if (rule.unlessFollowedBy?.test(norm.slice(ne, ne + FOLLOW_WINDOW))) continue;
        const start = map[ns];
        const end = map[ne - 1] + 1;
        const key = `${rule.id}:${start}:${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ rule_id: rule.id, label: rule.label, quote: text.slice(start, end), start, end, source: "rule" });
      }
    }
  }
  return out;
}

const NEEDS_CORROBORATION = new Set(RULES.filter((r) => r.needsCorroboration).map((r) => r.id));

/** Drops signals of weak rules (needsCorroboration) when no other rule fired in the same text. */
export function applyCorroboration(signals: Signal[]): Signal[] {
  // Hits in warning context do not corroborate anything.
  const ids = new Set(signals.filter((s) => s.context !== "warning").map((s) => s.rule_id));
  const strong = [...ids].filter((id) => !NEEDS_CORROBORATION.has(id));
  return strong.length > 0 ? signals : signals.filter((s) => !NEEDS_CORROBORATION.has(s.rule_id));
}
