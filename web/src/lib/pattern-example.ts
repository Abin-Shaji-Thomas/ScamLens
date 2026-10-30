import { PATTERN_GUIDE } from "./signals/pattern-guide";
import { RULES } from "./signals/rules";

export interface PatternExample {
  ruleId: string;
  name: string;
  text: string;
}

/**
 * `/?example=<rule_id>` from a "Try this example" link on /patterns. Only a rule id that exists in rules.ts and has a
 * guide entry is accepted; anything else (missing, repeated, unknown, other text) gives null and an empty box.
 */
export function patternExample(param: string | string[] | undefined): PatternExample | null {
  if (typeof param !== "string") return null;
  if (!RULES.some((r) => r.id === param) || !Object.hasOwn(PATTERN_GUIDE, param)) return null;
  const g = PATTERN_GUIDE[param];
  return { ruleId: param, name: g.name, text: g.example };
}

export const exampleHref = (ruleId: string) => `/?example=${encodeURIComponent(ruleId)}`;
