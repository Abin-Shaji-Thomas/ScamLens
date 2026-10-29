// Probes which chains the configured Etherscan V2 key can query (one balance call per chain, 1 call/s).
// Output feeds docs/CHAIN_SUPPORT.md. Never prints the key.
// Run from web/: npx tsx scripts/probe-etherscan-chains.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EVM_CHAINS } from "../src/lib/verified/etherscan";

const envFile = join(import.meta.dirname, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const key = process.env.ETHERSCAN_API_KEY;
console.log(`ETHERSCAN_API_KEY: ${key ? "SET" : "MISSING"}  ETHERSCAN_PLAN: ${process.env.ETHERSCAN_PLAN || "(free)"}`);
if (!key) process.exit(2);

const ADDRESS = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"; // EIP-55 spec test vector

async function main() {
  console.log(`date: ${new Date().toISOString()}`);
  for (const c of EVM_CHAINS) {
    const url = `https://api.etherscan.io/v2/api?chainid=${c.id}&module=account&action=balance&address=${ADDRESS}&tag=latest&apikey=${key}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const body = (await res.json()) as { status?: string; message?: string; result?: unknown };
      const result = typeof body.result === "string" ? body.result.slice(0, 90) : typeof body.result;
      const ok = body.status === "1";
      console.log(`${String(c.id).padEnd(6)} ${c.name.padEnd(13)} code freeTier=${String(c.freeTier).padEnd(5)} -> HTTP ${res.status} status=${body.status} ${ok ? "OK" : "REJECTED"}: ${ok ? "balance returned" : result}`);
    } catch (e) {
      console.log(`${String(c.id).padEnd(6)} ${c.name.padEnd(13)} -> network error (${e instanceof Error ? e.name : "error"})`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
void main();
