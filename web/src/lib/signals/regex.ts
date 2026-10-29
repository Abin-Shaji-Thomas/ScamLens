import { RULES } from "./rules";
import type { Signal } from "./types";

const NEGATION = /\b(never|not|don'?t|do not|no one|nobody|won'?t|will never|avoid)\b[^.\n]*$/i;
const NEGATION_WINDOW = 60; // chars to look back; the regex also stops at a sentence break

/** Deterministic pass: every regex hit becomes a signal with exact offsets. */
export function runRules(text: string): Signal[] {
  const out: Signal[] = [];
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      for (const m of text.matchAll(re)) {
        const start = m.index;
        if (rule.negatable && NEGATION.test(text.slice(Math.max(0, start - NEGATION_WINDOW), start))) continue;
        out.push({ rule_id: rule.id, label: rule.label, quote: m[0], start, end: start + m[0].length, source: "rule" });
      }
    }
  }
  return out;
}
