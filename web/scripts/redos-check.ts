// Measures every extractor and every signal-rule regex on adversarial 6000-char inputs.
// Run from web/: npx tsx scripts/redos-check.ts   (exit code 1 if any case takes >= 200 ms)
import { extractBtc, extractEvm, extractTron } from "../src/lib/extract/crypto";
import { extractDomains, extractPhone, extractTelegram, extractUpiAndEmail } from "../src/lib/extract/contact";
import { extractIdentifiers } from "../src/lib/identifiers";
import { RULES } from "../src/lib/signals/rules";
import { runRules } from "../src/lib/signals/regex";
import { locateQuote } from "../src/lib/signals/validate";

const N = 6000;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const rep = (s: string) => s.repeat(Math.ceil(N / s.length)).slice(0, N);
const INPUTS: Record<string, string> = {
  "@ run": rep("@"),
  ". run": rep("."),
  "a@ pairs": rep("a@"),
  "a. pairs": rep("a."),
  "a@b. chain": rep("a@b."),
  "base58 run": rep(B58),
  "T run": rep("T"),
  "1 run": rep("1"),
  "0x hex run": "0x" + rep("abcdef0123456789").slice(2),
  "bc1 run": "bc1" + rep("qpzry9x8gf2tvdw0s3jn54khce6mua7l").slice(3),
  "digits run": rep("9"),
  "digit space run": rep("9 "),
  "spaces": rep(" "),
  "newlines": rep("\n"),
  "unicode emoji": rep("😀"),
  "devanagari": rep("ठगी "),
  "word salad": rep("guarantee pay withdraw fee kyc telegram "),
  "dear without trigger": "my love " + rep("x "),
  "url-ish": rep("http://a."),
  "t.me/ run": rep("t.me/"),
};

const tests: [string, (s: string) => unknown][] = [
  ["extractEvm", extractEvm],
  ["extractTron", extractTron],
  ["extractBtc", extractBtc],
  ["extractUpiAndEmail", extractUpiAndEmail],
  ["extractPhone", extractPhone],
  ["extractTelegram", extractTelegram],
  ["extractDomains", extractDomains],
  ["extractIdentifiers (all)", extractIdentifiers],
  ["runRules (all)", runRules],
  ["locateQuote", (s) => locateQuote(s, "zzzz not present")],
  ...RULES.flatMap((r) => r.patterns.map((p, i) => [`rule ${r.id}#${i}`, (s: string) => [...s.matchAll(p)].length] as [string, (s: string) => unknown])),
];

let worst = { ms: 0, label: "" };
let failures = 0;
for (const [name, fn] of tests) {
  for (const [inputName, input] of Object.entries(INPUTS)) {
    const t0 = performance.now();
    fn(input);
    const ms = performance.now() - t0;
    if (ms > worst.ms) worst = { ms, label: `${name} on "${inputName}"` };
    if (ms >= 200) {
      failures++;
      console.log(`SLOW ${ms.toFixed(1)} ms  ${name} on "${inputName}"`);
    }
  }
}
console.log(`${tests.length} functions/regexes x ${Object.keys(INPUTS).length} inputs (${N} chars each)`);
console.log(`worst case: ${worst.ms.toFixed(1)} ms (${worst.label}); cases >= 200 ms: ${failures}`);
process.exitCode = failures ? 1 : 0;
