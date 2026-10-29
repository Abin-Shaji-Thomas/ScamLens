import { aiSignals, type LlmDeps } from "./llm";
import { applyCorroboration, runRules } from "./regex";
import type { AiStatus, Signal } from "./types";

export type { AiStatus, Signal } from "./types";

/** Regex pass + validated AI pass, deduplicated by (rule, span), weak rules kept only when corroborated, ordered by position. */
export async function detectSignals(text: string, deps: LlmDeps): Promise<{ signals: Signal[]; ai: AiStatus }> {
  const rule = runRules(text);
  const { signals: ai, ai: status } = await aiSignals(text, deps);
  const seen = new Set<string>();
  const merged: Signal[] = [];
  for (const s of [...rule, ...ai]) {
    const key = `${s.rule_id}:${s.start}:${s.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }
  return { signals: applyCorroboration(merged).sort((a, b) => a.start - b.start || a.rule_id.localeCompare(b.rule_id)), ai: status };
}
