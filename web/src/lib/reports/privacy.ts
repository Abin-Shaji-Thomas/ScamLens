import { createHmac } from "node:crypto";
import type { IdentifierType } from "../extract/types";

export { maskIdentifier } from "./mask";

// Identifiers like phone numbers are low-entropy, so a plain hash could be brute-forced.
// A server-side pepper (REPORT_HASH_PEPPER) makes stored hashes useless without it.
export const MIN_PEPPER_LENGTH = 16;

function hmac(pepper: string, msg: string): string {
  return createHmac("sha256", pepper).update(msg).digest("hex");
}

export function identifierHash(pepper: string, type: IdentifierType, value: string): string {
  return hmac(pepper, `id:${type}:${value}`);
}

export function fingerprintHash(pepper: string, ip: string, userAgent: string): string {
  return hmac(pepper, `fp:${ip}|${userAgent}`);
}
