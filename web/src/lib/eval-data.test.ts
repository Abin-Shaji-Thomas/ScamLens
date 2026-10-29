import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RULES } from "./signals/rules";

const data = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "eval", "chats.json"), "utf8"));
const added = data.chats.filter((c: { added?: string }) => c.added === "F5");

describe("eval/chats.json", () => {
  it("is marked synthetic and labelled as illustrative demo data", () => {
    expect(data.synthetic).toBe(true);
    expect(data.watermark).toMatch(/Illustrative demo data/);
  });
  it("F5 added >= 12 scam and >= 13 benign cases; every rule is labelled at least twice in the new scam cases", () => {
    const scam = added.filter((c: { label: string }) => c.label === "scam");
    expect(scam.length).toBeGreaterThanOrEqual(12);
    expect(added.length - scam.length).toBeGreaterThanOrEqual(13);
    for (const r of RULES) expect(scam.filter((c: { expected_rules: string[] }) => c.expected_rules.includes(r.id)).length, r.id).toBeGreaterThanOrEqual(2);
  });
  it("covers each obfuscation style", () => {
    const styles = new Set(added.map((c: { obfuscation?: string }) => c.obfuscation));
    for (const s of ["spaced letters", "mixed Hindi/English", "line breaks", "emoji separators"]) expect(styles).toContain(s);
  });
  it("new cases contain no 10-digit phone numbers", () => {
    for (const c of added) expect(c.text, c.id).not.toMatch(/\b[6-9]\d{9}\b/);
  });
});

describe("eval/chats.json round 2 (G3)", () => {
  const g3 = data.chats.filter((c: { added?: string }) => c.added === "G3");
  it("adds exactly 4 decoy-warning scams and 4 benign warnings", () => {
    expect(g3.filter((c: { label: string; decoy_warning?: boolean }) => c.label === "scam" && c.decoy_warning)).toHaveLength(4);
    expect(g3.filter((c: { label: string }) => c.label === "normal")).toHaveLength(4);
  });
  it("earlier cases are still present (66 before round 2)", () => {
    expect(data.chats.filter((c: { added?: string }) => c.added !== "G3")).toHaveLength(66);
  });
});
