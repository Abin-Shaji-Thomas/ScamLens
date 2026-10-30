import bs58check from "bs58check";
import { describe, expect, it } from "vitest";
import { extractIdentifiers, uniqueIdentifiers } from "./identifiers";

const types = (text: string) => extractIdentifiers(text).map((i) => i.type);
const only = (text: string) => {
  const ids = extractIdentifiers(text);
  expect(ids).toHaveLength(1);
  return ids[0];
};

/** Replace the character at `i` with a different character from `alphabet`. */
function flip(s: string, i: number, alphabet: string): string {
  const next = alphabet[(alphabet.indexOf(s[i]) + 1) % alphabet.length];
  return s.slice(0, i) + next + s.slice(i + 1);
}
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

describe("EVM (EIP-55)", () => {
  // Test vectors from https://eips.ethereum.org/EIPS/eip-55 ("Test Cases")
  const vectors = [
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
  ];
  it.each(vectors)("accepts checksummed %s", (addr) => {
    expect(only(`send to ${addr} today`)).toMatchObject({ type: "evm", value: addr, raw: addr, check: "checksum" });
  });
  it.each(vectors)("rejects %s with one letter's case flipped", (addr) => {
    const i = addr.search(/[a-fA-F]/);
    const bad = addr.slice(0, i) + (addr[i] === addr[i].toLowerCase() ? addr[i].toUpperCase() : addr[i].toLowerCase()) + addr.slice(i + 1);
    expect(types(bad)).toEqual([]);
  });
  it("accepts all-lowercase (no checksum) and normalises to checksum form", () => {
    expect(only(vectors[0].toLowerCase())).toMatchObject({ value: vectors[0], check: "format" });
  });
  it("ignores 0x strings longer than 40 hex chars", () => {
    expect(types(vectors[0] + "ab")).toEqual([]);
  });
});

describe("TRON (Base58Check, 0x41, 21 bytes)", () => {
  // USDT TRC-20 contract address published by Tether: https://tether.to/en/supported-protocols
  const usdt = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
  // Hex <-> base58 example from TRON developer docs (https://developers.tron.network/docs/account)
  const docsAddr = "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL";
  it("accepts the USDT TRC-20 contract address", () => {
    expect(only(`USDT contract: ${usdt}`)).toMatchObject({ type: "tron", value: usdt, check: "checksum" });
  });
  it("accepts the TRON docs address and its payload matches the documented hex", () => {
    expect(only(docsAddr).type).toBe("tron");
    expect(Buffer.from(bs58check.decode(docsAddr)).toString("hex").toUpperCase()).toBe(
      "418840E6C55B9ADA326D211D818C34A994AECED808",
    );
  });
  it("rejects a one-character flip", () => {
    expect(types(flip(usdt, 10, B58))).toEqual([]);
  });
});

describe("BTC", () => {
  // Genesis block coinbase address: https://en.bitcoin.it/wiki/Genesis_block
  const genesis = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
  // P2SH example from https://en.bitcoin.it/wiki/Invoice_address
  const p2sh = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";
  // BIP-173 examples: https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki
  const p2wpkhUpper = "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4";
  const p2wsh = "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3";
  // BIP-350 test vector (bech32m, v1): https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki
  const taproot = "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";

  it.each([genesis, p2sh, p2wpkhUpper, p2wsh, taproot])("accepts %s", (addr) => {
    expect(only(`btc: ${addr}`)).toMatchObject({ type: "btc", raw: addr, check: "checksum" });
  });
  it("normalises bech32 to lowercase", () => {
    expect(only(p2wpkhUpper).value).toBe(p2wpkhUpper.toLowerCase());
  });
  it("rejects a one-character flip of a legacy address", () => {
    expect(types(flip(genesis, 12, B58))).toEqual([]);
  });
  it("rejects a one-character flip of a bech32 address", () => {
    expect(types(flip(p2wsh, 20, BECH32))).toEqual([]);
  });
  it("rejects mixed-case bech32 (BIP-173)", () => {
    expect(types("BC1QW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toEqual([]);
  });
});

describe("UPI vs email", () => {
  it("handle@psp is UPI with format check", () => {
    expect(only("pay rahul.k@okaxis")).toMatchObject({ type: "upi", value: "rahul.k@okaxis", check: "format" });
  });
  it("a dot after @ makes it an email", () => {
    expect(only("mail rahul@gmail.com")).toMatchObject({ type: "email", value: "rahul@gmail.com" });
  });
  it("sentence-ending period does not turn UPI into email", () => {
    expect(only("Send it to shop99@ybl.")).toMatchObject({ type: "upi", raw: "shop99@ybl" });
  });
  it("mobile-number UPI is UPI, not a phone", () => {
    expect(types("9876543210@paytm")).toEqual(["upi"]);
  });
  it("email with invalid TLD is ignored", () => {
    expect(types("x@host.notarealtld")).toEqual([]);
  });
  it("email local part with a TLD-like segment is a single email", () => {
    expect(types("write to john.dev@example.com")).toEqual(["email"]);
  });
});

describe("Indian phone", () => {
  it.each([
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["9876543210", "+919876543210"],
    ["call 07012345678 now", "+917012345678"],
  ])("normalises %s", (input, value) => {
    expect(only(input)).toMatchObject({ type: "phone", value });
  });
  it("rejects numbers starting 1-5 and 11+ digit runs", () => {
    expect(types("1234567890 and 98765432101")).toEqual([]);
  });
});

describe("Telegram", () => {
  it("@handle of 5-32 chars", () => {
    expect(only("DM @Crypto_Guru99 for tips")).toMatchObject({ type: "telegram", value: "@crypto_guru99" });
  });
  it("too-short handle ignored", () => {
    expect(types("ask @abcd")).toEqual([]);
  });
  it("t.me link is telegram, not a domain", () => {
    expect(only("join https://t.me/Example_Channel!")).toMatchObject({
      type: "telegram",
      value: "@example_channel",
      raw: "https://t.me/Example_Channel",
    });
  });
});

describe("domains", () => {
  it("extracts hostname from URL and trims trailing punctuation", () => {
    expect(only("Update KYC at https://secure-kyc-update.in/login.")).toMatchObject({
      type: "domain",
      value: "secure-kyc-update.in",
      raw: "https://secure-kyc-update.in/login",
    });
  });
  it("ignores non-ICANN suffixes and decimals", () => {
    expect(types("version 1.5 of report.notatld")).toEqual([]);
  });
});

describe("no identifiers", () => {
  it.each(["", "Hi, how are you? See you at 5 pm.", "Rs. 500 paid, thanks!"])("returns [] for %j", (t) => {
    expect(extractIdentifiers(t)).toEqual([]);
  });
});

describe("mixed text", () => {
  it("finds every type in one chat, in order", () => {
    const text =
      "Sir, pay 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed or TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t, " +
      "UPI rahul@okaxis, call +91 98765 43210, TG @support_desk, site https://claim-bonus.in, mail a@b.com";
    expect(types(text)).toEqual(["evm", "tron", "upi", "phone", "telegram", "domain", "email"]);
  });
  it("uniqueIdentifiers drops repeats", () => {
    expect(uniqueIdentifiers(extractIdentifiers("@support_desk and @Support_Desk"))).toHaveLength(1);
  });
});

describe("slice invariant (randomized)", () => {
  function mulberry32(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const known: [string, string][] = [
    ["0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "evm"],
    ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", "tron"],
    ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "btc"],
    ["bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", "btc"],
    ["rahul@okaxis", "upi"],
    ["+91 98765 43210", "phone"],
    ["@support_desk", "telegram"],
    ["https://t.me/example_channel", "telegram"],
    ["help@example.com", "email"],
    ["https://claim-bonus.in/x", "domain"],
  ];
  const words = ["hello", "sir", "pay", "now", "₹500", "urgent", "ok", "👍", "1.5", "bhai", "kal"];
  const seps = [" ", ", ", "\n", " (", ") ", ". ", " - "];

  it("structured: every planted identifier is found and slices match", () => {
    const rand = mulberry32(42);
    const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
    for (let n = 0; n < 500; n++) {
      let text = "";
      const planted: [number, string, string][] = [];
      for (let k = 0; k < 12; k++) {
        if (rand() < 0.3) {
          const [raw, type] = pick(known);
          planted.push([text.length, raw, type]);
          text += raw;
        } else text += pick(words);
        text += pick(seps);
      }
      const ids = extractIdentifiers(text);
      for (const id of ids) expect(text.slice(id.start, id.end)).toBe(id.raw);
      for (const [start, raw, type] of planted) {
        expect(ids.find((i) => i.start === start)).toMatchObject({ raw, type });
      }
    }
  });

  it("noise: slices match on random character soup", () => {
    const rand = mulberry32(7);
    const alphabet = "abcXYZ0123456789@._-+/: \n" + B58;
    for (let n = 0; n < 2000; n++) {
      const len = Math.floor(rand() * 120);
      let text = "";
      for (let k = 0; k < len; k++) text += alphabet[Math.floor(rand() * alphabet.length)];
      for (const id of extractIdentifiers(text)) expect(text.slice(id.start, id.end)).toBe(id.raw);
    }
  });
});

describe("EIP-55 spec vectors beyond the 'Normal' set (final round P2)", () => {
  // https://eips.ethereum.org/EIPS/eip-55 "Test Cases": the all-caps and all-lower vectors are valid checksums whose
  // encoding happens to be single-case, so they cannot be told apart from unchecked input: accepted as "format".
  it.each([
    "0x52908400098527886E0F7030069857D2E4169EE7",
    "0x8617E340B3D01FA5F11F306F4090FD50E238070D",
    "0xde709f2102306220921060314715629080e2fb77",
    "0x27b1fdb04752bbc536007a920d24acb045561c26",
  ])("accepts %s as format and keeps the spec spelling", (addr) => {
    expect(only(addr)).toMatchObject({ type: "evm", value: addr, check: "format" });
  });
  it("rejects 0x5aAeb6053F3E94C9b9A09f33669435E7EF1BeAed (the spec vector with one letter's case flipped)", () => {
    expect(types("0x5aAeb6053F3E94C9b9A09f33669435E7EF1BeAed")).toEqual([]);
    expect(only("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed").check).toBe("checksum");
  });
  it("rejects an Indian number starting with 5 and a 9-digit number", () => {
    expect(types("+91 58765 43210")).toEqual([]);
    expect(types("+91 98765 4321")).toEqual([]);
  });
});
