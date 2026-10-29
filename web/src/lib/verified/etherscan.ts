import { formatEther } from "viem";
import { z } from "zod";
import { positiveIntEnv } from "../env";
import type { Identifier } from "../extract/types";
import { getJson, isoDate, Unavailable } from "./http";
import { unavailable, type CheckDeps, type SourceResult } from "./types";

// freeTier: Etherscan's free API plan answers "Free API access is not supported for this chain" for BNB and Base.
export const EVM_CHAINS = [
  { id: 1, name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io", freeTier: true },
  { id: 56, name: "BNB Chain", symbol: "BNB", explorer: "https://bscscan.com", freeTier: false },
  { id: 137, name: "Polygon", symbol: "POL", explorer: "https://polygonscan.com", freeTier: true },
  { id: 8453, name: "Base", symbol: "ETH", explorer: "https://basescan.org", freeTier: false },
  { id: 42161, name: "Arbitrum One", symbol: "ETH", explorer: "https://arbiscan.io", freeTier: true },
] as const;
type Chain = (typeof EVM_CHAINS)[number];

const API = "https://api.etherscan.io/v2/api";
const AccountResp = z.object({ status: z.string(), message: z.string(), result: z.unknown() });
const ProxyResp = z.object({ result: z.string() });
const Tx = z.object({ timeStamp: z.string() });

// Per-instance limiter. The free plan advertises 3 calls/s but rejects bursts at that rate in practice
// (measured 2026-10-29: 3/s and 2.7/s hit "Max calls per sec", 2/s passes), so default to 2/s.
export const DEFAULT_ETHERSCAN_RPS = 2;
let nextSlot = 0;
async function slot(rps: number) {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 1000 / rps + 30;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export const chainEnabled = (chain: Chain, env: CheckDeps["env"]) => chain.freeTier || env.ETHERSCAN_PLAN === "paid";

const isRateLimited = (raw: unknown) => {
  const r = AccountResp.safeParse(raw);
  return r.success && typeof r.data.result === "string" && /rate limit/i.test(r.data.result);
};

async function call(deps: CheckDeps, chain: Chain, params: string): Promise<unknown> {
  const rps = positiveIntEnv(deps.env.ETHERSCAN_RPS, DEFAULT_ETHERSCAN_RPS);
  const url = `${API}?chainid=${chain.id}&${params}&apikey=${deps.env.ETHERSCAN_API_KEY}`;
  // Network jitter can bunch requests together at Etherscan's side even when we space them,
  // so a "rate limit" answer gets exactly one retry after a pause.
  await slot(rps);
  const raw = await getJson(deps, url);
  if (!isRateLimited(raw)) return raw;
  await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
  await slot(rps);
  return getJson(deps, url);
}
export let RETRY_PAUSE_MS = 1100;
export const setRetryPauseForTests = (ms: number) => (RETRY_PAUSE_MS = ms);

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

// Successful lookups are cached per server instance for 10 minutes to save rate-limit budget.
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; result: SourceResult }>();
export const clearEtherscanCache = () => cache.clear();

export async function checkEtherscanChain(id: Identifier, chain: Chain, deps: CheckDeps): Promise<SourceResult> {
  const key = `${chain.id}:${id.value}`;
  const hit = cache.get(key);
  if (hit && deps.now().getTime() - hit.at < CACHE_MS) return { ...hit.result, checkedAt: new Date(hit.at).toISOString() };
  const result = await lookupChain(id, chain, deps);
  if (result.status === "info") cache.set(key, { at: deps.now().getTime(), result });
  return result;
}

async function lookupChain(id: Identifier, chain: Chain, deps: CheckDeps): Promise<SourceResult> {
  const base = {
    source: "etherscan" as const,
    sourceName: `Etherscan V2 (${chain.name})`,
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    link: `${chain.explorer}/address/${id.value}`,
  };
  if (!deps.env.ETHERSCAN_API_KEY) return unavailable(base, "ETHERSCAN_API_KEY not configured");
  if (!chainEnabled(chain, deps.env)) return unavailable(base, `${chain.name} is not included in the Etherscan free API plan`);

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
    : sent > 0 || code !== "0x"
      ? `${chain.name}: ${kind.toLowerCase()}, no normal transactions listed, ${sent} outgoing tx (nonce), balance ${bal}.`
      : `${chain.name}: no transactions found, balance ${bal}.`;
  return { ...base, status: "info", summary, facts };
}
