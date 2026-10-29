import { z } from "zod";
import type { Db } from "../reports/db";
import { Q1Row, Q2Row, Q3Row, Q4Edge, type GraphBackend, type LinkQuery, type LinkResult } from "./types";

/** Fallback backend: recursive CTEs in db/schema.sql, called through the same Db used for reports. */
export function postgresBackend(db: Db): GraphBackend {
  return {
    name: "postgres",
    async run<Q extends LinkQuery>(q: Q, hubMax: number): Promise<LinkResult<Q>> {
      switch (q.kind) {
        case "q1":
          return z.array(Q1Row).parse(await db.call("q1_upi_wallet_telegram", { p_upi: q.upiHash, p_hub_max: hubMax })) as LinkResult<Q>;
        case "q2":
          return z.array(Q2Row).parse(await db.call("q2_payment_to_flagged", { p_wallet: q.walletHash, p_hub_max: hubMax })) as LinkResult<Q>;
        case "q3":
          return z.array(Q3Row).parse(await db.call("q3_telegram_clusters", { p_min_size: q.minSize, p_hub_max: hubMax })) as LinkResult<Q>;
        case "q4":
          return z
            .array(Q4Edge)
            .parse(await db.call("q4_neighbourhood", { p_hash: q.hash, p_depth: q.depth, p_hub_max: hubMax })) as LinkResult<Q>;
        default:
          throw new Error("unknown query");
      }
    },
  };
}
