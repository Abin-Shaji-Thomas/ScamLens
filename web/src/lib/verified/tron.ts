import { z } from "zod";
import type { Identifier } from "../extract/types";
import { getJson, isoDate, Unavailable } from "./http";
import type { CheckDeps, SourceResult } from "./types";

const Account = z.object({
  balance: z.number().optional(),
  create_time: z.number().optional(),
  latest_opration_time: z.number().optional(), // sic: TronGrid's field name
  type: z.string().optional(),
});
const Resp = z.object({ data: z.array(Account), success: z.boolean().optional() });

export async function checkTronGrid(id: Identifier, deps: CheckDeps): Promise<SourceResult> {
  const key = deps.env.TRONGRID_API_KEY;
  const raw = await getJson(deps, `https://api.trongrid.io/v1/accounts/${id.value}`, key ? { "TRON-PRO-API-KEY": key } : {});
  const body = Resp.safeParse(raw);
  if (!body.success || body.data.success === false) throw new Unavailable("invalid response");

  const base = {
    source: "trongrid" as const,
    sourceName: "TronGrid (TRON mainnet)",
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    link: `https://tronscan.org/#/address/${id.value}`,
    status: "info" as const,
  };
  const acct = body.data.data[0];
  if (!acct) return { ...base, summary: "TRON: account not activated on-chain (no history).", facts: [] };

  const kind = acct.type === "Contract" ? "Smart contract" : "Account";
  const bal = `${((acct.balance ?? 0) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })} TRX`;
  const created = acct.create_time ? isoDate(acct.create_time) : "unknown";
  const lastActive = acct.latest_opration_time ? isoDate(acct.latest_opration_time) : "unknown";
  return {
    ...base,
    summary: `TRON: ${kind.toLowerCase()}, created ${created}, last activity ${lastActive}, balance ${bal}.`,
    facts: [
      { label: "Type", value: kind },
      { label: "Balance", value: bal },
      { label: "Created", value: created },
      { label: "Last activity", value: lastActive },
    ],
  };
}
