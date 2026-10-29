// Request/response schemas for /api/check. Kept free of server-only imports so
// client components can validate responses without bundling list data.
import { z } from "zod";
import { Identifier } from "./extract/types";
import { Risk } from "./risk";
import { AiStatus, Signal } from "./signals/types";
import { SourceResult } from "./verified/types";

export const MAX_INPUT_CHARS = 20000;

export const CheckRequest = z.object({ text: z.string().trim().min(1).max(MAX_INPUT_CHARS) });
export type CheckRequest = z.infer<typeof CheckRequest>;

export const CheckResponse = z.object({
  identifiers: z.array(Identifier),
  verified: z.array(SourceResult),
  reported: z.array(z.unknown()),
  suspected: z.array(Signal),
  ai: AiStatus,
  risk: Risk,
  checkedAt: z.string(),
});
export type CheckResponse = z.infer<typeof CheckResponse>;
