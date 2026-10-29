// Bech32 (BIP-173) and Bech32m (BIP-350) decoding for Bitcoin segwit addresses.
// Ported from the reference implementation linked in BIP-173.
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32M_CONST = 0x2bc830a3;

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const codes = [...hrp].map((c) => c.charCodeAt(0));
  return [...codes.map((c) => c >> 5), 0, ...codes.map((c) => c & 31)];
}

function convertBits(data: number[], from: number, to: number): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) return null;
  return out;
}

/** Returns true if `addr` is a valid mainnet segwit address (bc1...). */
export function isValidSegwitAddress(addr: string): boolean {
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return false;
  const s = addr.toLowerCase();
  const pos = s.lastIndexOf("1");
  if (pos < 1 || pos + 7 > s.length || s.length > 90) return false;
  const hrp = s.slice(0, pos);
  if (hrp !== "bc") return false;
  const data: number[] = [];
  for (const c of s.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d === -1) return false;
    data.push(d);
  }
  const chk = polymod([...hrpExpand(hrp), ...data]);
  const encoding = chk === 1 ? "bech32" : chk === BECH32M_CONST ? "bech32m" : null;
  if (!encoding) return false;
  const words = data.slice(0, -6);
  if (words.length < 1) return false;
  const version = words[0];
  if (version > 16) return false;
  const program = convertBits(words.slice(1), 5, 8);
  if (!program || program.length < 2 || program.length > 40) return false;
  if (version === 0) return encoding === "bech32" && (program.length === 20 || program.length === 32);
  return encoding === "bech32m";
}
