import { createHmac, randomBytes } from "node:crypto";

/** 128 random bits shown once as eight groups of four hex characters; only its HMAC is stored. */
export function newDeleteCode(): string {
  return randomBytes(16).toString("hex").match(/.{4}/g)!.join("-");
}

export const normaliseDeleteCode = (code: string) => code.toLowerCase().replace(/[^0-9a-f]/g, "");

/** HMAC-SHA256 with the server pepper, so a leaked table cannot be matched against guessed codes offline. */
export function deleteCodeHash(pepper: string, code: string): string {
  return createHmac("sha256", pepper).update(`case-delete:${normaliseDeleteCode(code)}`).digest("hex");
}

export const isWellFormedDeleteCode = (code: string) => normaliseDeleteCode(code).length === 32;
