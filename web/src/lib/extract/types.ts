import { z } from "zod";

export const IDENTIFIER_TYPES = ["evm", "tron", "btc", "upi", "phone", "telegram", "email", "domain"] as const;
export const IdentifierType = z.enum(IDENTIFIER_TYPES);
export type IdentifierType = z.infer<typeof IdentifierType>;

export const Identifier = z.object({
  type: IdentifierType,
  value: z.string(), // normalised form used for lookups
  raw: z.string(), // exact text as it appears in the input
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  check: z.enum(["checksum", "format"]),
});
export type Identifier = z.infer<typeof Identifier>;

export const BASE58 = "[1-9A-HJ-NP-Za-km-z]";
const TRAILING_PUNCT = /[.,;:!?)\]}'"-]+$/;

export function stripTrailingPunct(raw: string): string {
  return raw.replace(TRAILING_PUNCT, "");
}

export function make(
  type: IdentifierType,
  value: string,
  raw: string,
  start: number,
  check: Identifier["check"],
): Identifier {
  return { type, value, raw, start, end: start + raw.length, check };
}
