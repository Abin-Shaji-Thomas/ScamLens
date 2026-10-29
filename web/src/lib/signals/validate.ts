import { z } from "zod";
import { ruleById } from "./rules";
import type { Signal } from "./types";

export const AiItem = z.object({ rule_id: z.string(), quote: z.string() });
export const AiOutput = z.object({ signals: z.array(z.unknown()) });

const MIN_QUOTE = 3;
const MAX_QUOTE = 300;

/** Collapse whitespace runs to one space, keeping a map from each output char back to its input offset. */
function normalise(s: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let inSpace = false;
  for (let i = 0; i < s.length; i++) {
    if (/\s/.test(s[i])) {
      if (!inSpace && norm.length > 0) {
        norm += " ";
        map.push(i);
      }
      inSpace = true;
    } else {
      norm += s[i];
      map.push(i);
      inSpace = false;
    }
  }
  return { norm, map };
}

/** Locate `quote` in `text` ignoring whitespace differences; returns exact offsets in `text`. */
export function locateQuote(text: string, quote: string): { start: number; end: number } | null {
  const q = normalise(quote).norm.trim();
  if (q.length < MIN_QUOTE || q.length > MAX_QUOTE) return null;
  const { norm, map } = normalise(text);
  const at = norm.indexOf(q);
  if (at === -1) return null;
  return { start: map[at], end: map[at + q.length - 1] + 1 };
}

/**
 * The AI proposes, code disposes: keep only items whose rule_id is in the fixed list
 * and whose quote really occurs in the input. Returned quotes are re-cut from the input.
 */
export function validateAiItems(raw: unknown, text: string): { signals: Signal[]; dropped: number } {
  const parsed = AiOutput.safeParse(raw);
  if (!parsed.success) return { signals: [], dropped: 0 };
  const signals: Signal[] = [];
  let dropped = 0;
  for (const item of parsed.data.signals) {
    const it = AiItem.safeParse(item);
    const rule = it.success ? ruleById(it.data.rule_id) : undefined;
    const loc = it.success && rule ? locateQuote(text, it.data.quote) : null;
    if (!it.success || !rule || !loc) {
      dropped++;
      continue;
    }
    signals.push({ rule_id: rule.id, label: rule.label, quote: text.slice(loc.start, loc.end), ...loc, source: "ai" });
  }
  return { signals, dropped };
}
