import { z } from "zod";

// Shape of the snapshot files written by scripts/sync-lists.ts into web/data/.
export const OfacSnapshot = z.object({
  schema_version: z.literal(1),
  source: z.string(),
  source_url: z.url(),
  fetched_at: z.iso.datetime(),
  publish_date: z.string(),
  record_count: z.number().int(),
  address_count: z.number().int(),
  addresses: z.array(
    z.object({
      address: z.string(),
      currency: z.string(),
      sdn_uid: z.string(),
      sdn_name: z.string(),
      programs: z.array(z.string()),
    }),
  ),
});
export type OfacSnapshot = z.infer<typeof OfacSnapshot>;

export const ScamSnifferSnapshot = z.object({
  schema_version: z.literal(1),
  source: z.string(),
  source_url: z.url(),
  repo_url: z.url(),
  license: z.string(),
  fetched_at: z.iso.datetime(),
  upstream_commit: z.string(),
  upstream_committed_at: z.iso.datetime(),
  delay_note: z.string(),
  address_count: z.number().int(),
  skipped_invalid: z.number().int(),
  addresses: z.array(z.string()),
});
export type ScamSnifferSnapshot = z.infer<typeof ScamSnifferSnapshot>;

/** Normalise an address for list matching: hex and bech32 are case-insensitive, base58 is not. */
export function normaliseAddress(addr: string): string {
  const a = addr.trim();
  return /^0x[0-9a-fA-F]+$/.test(a) || /^(bc1|BC1)/.test(a) ? a.toLowerCase() : a;
}
