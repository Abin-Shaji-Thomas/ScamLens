import { z } from "zod";

export interface Rule {
  id: string;
  label: string;
  patterns: RegExp[];
  /** Drop matches preceded by a negation ("never share your OTP") — typical of genuine warnings. */
  negatable?: boolean;
}

export const Signal = z.object({
  rule_id: z.string(),
  label: z.string(),
  quote: z.string(), // exact substring of the input: text.slice(start, end)
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  source: z.enum(["rule", "ai"]),
});
export type Signal = z.infer<typeof Signal>;

export const AiStatus = z.object({
  status: z.enum(["ok", "unavailable"]),
  model: z.string().optional(),
  reason: z.string().optional(),
  dropped: z.number().int().nonnegative().default(0), // AI items rejected by validation
});
export type AiStatus = z.infer<typeof AiStatus>;
