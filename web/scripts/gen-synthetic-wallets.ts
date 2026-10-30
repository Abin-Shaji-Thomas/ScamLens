// Prints synthetic wallet addresses for test and demo data: each is the address of a freshly generated random private
// key that is discarded at once, so no one controls or owns it. Usage: npx tsx scripts/gen-synthetic-wallets.ts [evm] [tron]
import bs58check from "bs58check";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const [evmCount = "10", tronCount = "4"] = process.argv.slice(2);
const evm = Array.from({ length: Number(evmCount) }, () => privateKeyToAccount(generatePrivateKey()).address);
const tron = Array.from({ length: Number(tronCount) }, () => {
  const a = privateKeyToAccount(generatePrivateKey()).address;
  // TRON uses the same 20-byte account id with a 0x41 prefix, Base58Check-encoded.
  return bs58check.encode(Buffer.concat([Buffer.from([0x41]), Buffer.from(a.slice(2), "hex")]));
});
console.log(JSON.stringify({ evm, tron }, null, 1));
