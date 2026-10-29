import bs58check from "bs58check";
import { getAddress, isAddress } from "viem";
import { isValidSegwitAddress } from "./bech32";
import { BASE58, make, type Identifier } from "./types";

const EVM_RE = /(?<![0-9A-Za-z])0x[0-9a-fA-F]{40}(?![0-9A-Za-z])/g;
const TRON_RE = new RegExp(`(?<![0-9A-Za-z])T${BASE58}{33}(?![0-9A-Za-z])`, "g");
const BTC_LEGACY_RE = new RegExp(`(?<![0-9A-Za-z])[13]${BASE58}{25,34}(?![0-9A-Za-z])`, "g");
const BTC_BECH32_RE = /(?<![0-9A-Za-z])(?:bc1|BC1)[02-9ac-hj-np-zAC-HJ-NP-Z]{6,87}(?![0-9A-Za-z])/g;

export function extractEvm(text: string): Identifier[] {
  const out: Identifier[] = [];
  for (const m of text.matchAll(EVM_RE)) {
    const raw = m[0];
    const hex = raw.slice(2);
    const mixedCase = /[a-f]/.test(hex) && /[A-F]/.test(hex);
    // EIP-55: a mixed-case address must match its checksum; single-case carries no checksum.
    if (mixedCase && !isAddress(raw, { strict: true })) continue;
    out.push(make("evm", getAddress(raw.toLowerCase()), raw, m.index, mixedCase ? "checksum" : "format"));
  }
  return out;
}

export function extractTron(text: string): Identifier[] {
  const out: Identifier[] = [];
  for (const m of text.matchAll(TRON_RE)) {
    const payload = bs58check.decodeUnsafe(m[0]);
    if (!payload || payload.length !== 21 || payload[0] !== 0x41) continue;
    out.push(make("tron", m[0], m[0], m.index, "checksum"));
  }
  return out;
}

export function extractBtc(text: string): Identifier[] {
  const out: Identifier[] = [];
  for (const m of text.matchAll(BTC_LEGACY_RE)) {
    const payload = bs58check.decodeUnsafe(m[0]);
    // 0x00 = P2PKH, 0x05 = P2SH on mainnet.
    if (!payload || payload.length !== 21 || (payload[0] !== 0x00 && payload[0] !== 0x05)) continue;
    out.push(make("btc", m[0], m[0], m.index, "checksum"));
  }
  for (const m of text.matchAll(BTC_BECH32_RE)) {
    if (!isValidSegwitAddress(m[0])) continue;
    out.push(make("btc", m[0].toLowerCase(), m[0], m.index, "checksum"));
  }
  return out;
}
