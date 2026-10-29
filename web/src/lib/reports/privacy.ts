import { createHash, createHmac } from "node:crypto";
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

/**
 * Reporter fingerprint = HMAC of the client IP only. The User-Agent is deliberately left out:
 * including it let one person mint a new "independent" reporter just by changing browsers.
 * People behind one shared IP (a college network) count as one reporter, which errs on the safe side.
 */
export function fingerprintHash(pepper: string, ip: string): string {
  return hmac(pepper, `fp:${ip}`);
}

/**
 * Pseudonymous reporter key stored on graph edges and TigerGraph Report vertices, so graph links can
 * require different reporters without copying the fingerprint itself. Same formula as db/schema.sql.
 */
export function reporterKey(fingerprint: string): string {
  return createHash("sha256").update(`reporter:${fingerprint}`).digest("hex").slice(0, 16);
}
