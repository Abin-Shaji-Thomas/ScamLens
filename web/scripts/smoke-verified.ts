// Live smoke test of the verified tier against real APIs.
// Run from web/: npx tsx scripts/smoke-verified.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractIdentifiers } from "../src/lib/identifiers";
import { runVerifiedChecks } from "../src/lib/verified";
import { OfacSnapshot } from "../src/lib/verified/lists-schema";
import { defaultDeps } from "../src/lib/verified/types";

const envFile = join(import.meta.dirname, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const KEYS = ["ETHERSCAN_API_KEY", "TRONGRID_API_KEY"];
console.log("env presence:", KEYS.map((k) => `${k}=${process.env[k] ? "set" : "missing"}`).join(" "));

const ofac = OfacSnapshot.parse(JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "ofac-sdn-addresses.json"), "utf8")));
const sanctioned = ofac.addresses.find((a) => a.currency === "ETH")!;
const sanctionedTron = ofac.addresses.find((a) => a.currency === "TRX")!;
const clean = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"; // EIP-55 spec test vector
if (ofac.addresses.some((a) => a.address.toLowerCase() === clean.toLowerCase())) throw new Error("clean address is on OFAC");

console.log(`OFAC snapshot published ${ofac.publish_date}; sanctioned sample = ${sanctioned.address} (SDN uid ${sanctioned.sdn_uid})`);
console.log(`clean sample = ${clean}\n`);

async function main() {
  for (const addr of [sanctioned.address, clean, sanctionedTron.address]) {
    const t0 = Date.now();
    const results = await runVerifiedChecks(extractIdentifiers(addr), defaultDeps());
    console.log(`== ${addr}  (${Date.now() - t0} ms)`);
    for (const r of results) {
      console.log(`  [${r.status.padEnd(11)}] ${r.sourceName.padEnd(28)} ${r.summary}`);
    }
    console.log();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
