import { z } from "zod";
import type { IdentifierType } from "../extract/types";

export const Q1Row = z.object({
  upi: z.string(),
  wallet: z.string(),
  wallet_hash: z.string(),
  telegram: z.string(),
  telegram_hash: z.string(),
  evidence_1: z.string(),
  evidence_2: z.string(),
});
export const Q2Row = z.object({
  hops: z.number().int(),
  path: z.array(z.string()),
  path_display: z.array(z.string()),
  flagged_source: z.string(),
  evidence: z.array(z.string()),
});
export const Q3Row = z.object({
  wallet: z.string(),
  wallet_hash: z.string(),
  cluster_size: z.number().int(),
  handles: z.array(z.string()),
  reports: z.number().int(),
});
export const Q4Edge = z.object({
  src: z.string(),
  src_type: z.string(),
  src_display: z.string(),
  dst: z.string(),
  dst_type: z.string(),
  dst_display: z.string(),
  relation: z.enum(["co_reported", "payment"]),
  evidence: z.string(),
});
export type Q1Row = z.infer<typeof Q1Row>;
export type Q2Row = z.infer<typeof Q2Row>;
export type Q3Row = z.infer<typeof Q3Row>;
export type Q4Edge = z.infer<typeof Q4Edge>;

export type LinkQuery =
  | { kind: "q1"; upiHash: string }
  | { kind: "q2"; walletHash: string }
  | { kind: "q3"; minSize: number }
  | { kind: "q4"; hash: string; depth: number; idType: IdentifierType };

export type LinkResult<Q extends LinkQuery> = Q extends { kind: "q1" }
  ? Q1Row[]
  : Q extends { kind: "q2" }
    ? Q2Row[]
    : Q extends { kind: "q3" }
      ? Q3Row[]
      : Q4Edge[];

/** TigerGraph vertex type for each identifier kind (emails share the Domain vertex type, told apart by `kind`). */
export const VERTEX_TYPE: Record<IdentifierType, string> = {
  evm: "Wallet",
  tron: "Wallet",
  btc: "Wallet",
  upi: "UPI",
  telegram: "TelegramHandle",
  phone: "PhoneNumber", // not "Phone": Savanna's starter fraud graph already defines a global Phone type
  email: "Domain",
  domain: "Domain",
};

export interface GraphBackend {
  name: "tigergraph" | "postgres";
  run<Q extends LinkQuery>(q: Q, hubMax: number): Promise<LinkResult<Q>>;
}
