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
    expect(data.chats.filter((c: { added?: string }) => c.added !== "G3" && c.added !== "J3" && c.added !== "P2")).toHaveLength(66);
  });
});

describe("eval/chats.json final round (J3)", () => {
  const j3 = data.chats.filter((c: { added?: string }) => c.added === "J3");
  it("adds exactly 3 decoy-warning scams and 3 benign warnings, after the 74 earlier cases", () => {
    expect(j3.filter((c: { label: string; decoy_warning?: boolean }) => c.label === "scam" && c.decoy_warning)).toHaveLength(3);
    expect(j3.filter((c: { label: string }) => c.label === "normal")).toHaveLength(3);
    expect(data.chats.slice(0, 74).some((c: { added?: string }) => c.added === "J3")).toBe(false);
    expect(data.chats.slice(74, 80).every((c: { added?: string }) => c.added === "J3")).toBe(true); // J3 is cases 75-80
    expect(new Set(data.chats.map((c: { id: string }) => c.id)).size).toBe(data.chats.length); // ids stay unique
  });
});

describe("eval/chats.json final round P2 (appended only)", () => {
  it("appends 1 scam and 2 hard negatives after the 80 earlier cases, leaving those unchanged in order", () => {
    const p2 = data.chats.slice(80);
    expect(data.chats).toHaveLength(83);
    expect(p2.map((c: { id: string }) => c.id)).toEqual(["p01", "p02", "p03"]);
    expect(p2.every((c: { added?: string }) => c.added === "P2")).toBe(true);
    expect(p2.filter((c: { label: string }) => c.label === "scam")).toHaveLength(1);
    expect(p2.filter((c: { label: string; hard_negative?: boolean }) => c.label === "normal" && c.hard_negative)).toHaveLength(2);
    expect(data.chats.slice(0, 80).some((c: { added?: string }) => c.added === "P2")).toBe(false);
  });
});
