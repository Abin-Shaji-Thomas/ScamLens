import { formatEther } from "viem";
import { z } from "zod";
import type { Identifier } from "../extract/types";
import { getJson, isoDate, Unavailable } from "./http";
import { unavailable, type CheckDeps, type SourceResult } from "./types";

export const EVM_CHAINS = [
  { id: 1, name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io" },
  { id: 56, name: "BNB Chain", symbol: "BNB", explorer: "https://bscscan.com" },
  { id: 137, name: "Polygon", symbol: "POL", explorer: "https://polygonscan.com" },
  { id: 8453, name: "Base", symbol: "ETH", explorer: "https://basescan.org" },
  { id: 42161, name: "Arbitrum One", symbol: "ETH", explorer: "https://arbiscan.io" },
] as const;
type Chain = (typeof EVM_CHAINS)[number];

const API = "https://api.etherscan.io/v2/api";
const AccountResp = z.object({ status: z.string(), message: z.string(), result: z.unknown() });
const ProxyResp = z.object({ result: z.string() });
const Tx = z.object({ timeStamp: z.string() });

// Simple per-instance limiter so a 5-chain lookup stays inside the free tier (5 calls/s by default).
let nextSlot = 0;
async function slot(rps: number) {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / rps;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

async function call(deps: CheckDeps, chain: Chain, params: string): Promise<unknown> {
  await slot(Number(deps.env.ETHERSCAN_RPS ?? "5"));
  return getJson(deps, `${API}?chainid=${chain.id}&${params}&apikey=${deps.env.ETHERSCAN_API_KEY}`);
}

async function proxy(deps: CheckDeps, chain: Chain, action: string, address: string): Promise<string> {
  const raw = await call(deps, chain, `module=proxy&action=${action}&address=${address}&tag=latest`);
  const r = ProxyResp.safeParse(raw);
  if (!r.success || !r.data.result.startsWith("0x")) throw new Unavailable(errorText(raw));
  return r.data.result;
}

async function account(deps: CheckDeps, chain: Chain, params: string): Promise<unknown> {
  const r = AccountResp.safeParse(await call(deps, chain, `module=account&${params}`));
  if (!r.success) throw new Unavailable("invalid response");
  if (r.data.status === "1") return r.data.result;
  if (r.data.message.startsWith("No transactions found")) return [];
  throw new Unavailable(errorText(r.data));
}

function errorText(raw: unknown): string {
  const r = AccountResp.safeParse(raw);
  const msg = r.success && typeof r.data.result === "string" ? r.data.result : "unexpected response";
  return msg.slice(0, 120);
}

async function firstTxTime(deps: CheckDeps, chain: Chain, address: string, sort: "asc" | "desc") {
  const list = z.array(Tx).parse(
    await account(deps, chain, `action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=${sort}`),
  );
  return list.length ? isoDate(Number(list[0].timeStamp) * 1000) : null;
}

export async function checkEtherscanChain(id: Identifier, chain: Chain, deps: CheckDeps): Promise<SourceResult> {
  const base = {
    source: "etherscan" as const,
    sourceName: `Etherscan V2 (${chain.name})`,
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    link: `${chain.explorer}/address/${id.value}`,
  };
  if (!deps.env.ETHERSCAN_API_KEY) return unavailable(base, "ETHERSCAN_API_KEY not configured");

  const [balance, nonce, code, first, last] = await Promise.all([
    account(deps, chain, `action=balance&address=${id.value}&tag=latest`),
    proxy(deps, chain, "eth_getTransactionCount", id.value),
    proxy(deps, chain, "eth_getCode", id.value),
    firstTxTime(deps, chain, id.value, "asc"),
    firstTxTime(deps, chain, id.value, "desc"),
  ]);
  if (typeof balance !== "string" || !/^\d+$/.test(balance)) throw new Unavailable("invalid balance");

  const sent = Number(BigInt(nonce));
  const kind = code === "0x" ? "Wallet (EOA)" : "Smart contract";
  const bal = `${formatEther(BigInt(balance))} ${chain.symbol}`;
  const facts = [
    { label: "Type", value: kind },
    { label: "Balance", value: bal },
    { label: "Outgoing transactions (nonce)", value: String(sent) },
    { label: "First transaction", value: first ?? "none found" },
    { label: "Last transaction", value: last ?? "none found" },
  ];
  const summary = first
    ? `${chain.name}: ${kind.toLowerCase()}, active ${first} to ${last}, ${sent} outgoing tx, balance ${bal}.`
    : `${chain.name}: no transactions found, balance ${bal}.`;
  return { ...base, status: "info", summary, facts };
}
