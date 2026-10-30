import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiskCard } from "../components/RiskCard";
import { runCheck, type RunDeps } from "./check";
import { claimNewLine, NEW_LINE_KEY, newLineText } from "./new-line";
import { SAMPLES } from "./samples";

const offline: RunDeps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date("2026-10-30T10:00:00Z"), env: {}, db: null };

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("one-time New line (H2f)", () => {
  it("wording names the receipt only when there is one", () => {
    expect(newLineText(true)).toBe("New: signed receipt, what was checked, and an 'I already paid' plan are below.");
    expect(newLineText(false)).toBe("New: what was checked, and an 'I already paid' plan are below.");
  });

  it("first call in a session claims the line and records it; later calls do not", () => {
    const s = memoryStorage();
    expect(claimNewLine(() => s)).toBe(true);
    expect(s.getItem(NEW_LINE_KEY)).toBe("1");
    expect(claimNewLine(() => s)).toBe(false);
    expect(claimNewLine(() => s)).toBe(false);
  });

  it("blocked or missing storage never throws and still allows the line", () => {
    const throwing = () => { throw new Error("SecurityError"); };
    expect(claimNewLine(throwing)).toBe(true);
    const bad = { ...memoryStorage(), getItem: () => { throw new Error("blocked"); } } as Storage;
    expect(claimNewLine(() => bad)).toBe(true);
    expect(claimNewLine(() => undefined)).toBe(true);
    expect(() => claimNewLine()).not.toThrow(); // no sessionStorage in this Node test run
  });

  it("RiskCard shows the line under the badge only when told to, and not in print", async () => {
    const r = await runCheck({ text: SAMPLES[0].text }, offline);
    const on = renderToStaticMarkup(createElement(RiskCard, { result: r, showNew: true }));
    expect(on).toContain(`<p class="t-small mt-4 text-swiss-text print:hidden" data-new-line="true">${newLineText(false).replace(/'/g, "&#x27;")}</p>`);
    expect(on.indexOf("data-new-line")).toBeGreaterThan(on.indexOf("risk-card-title"));
    expect(on.indexOf("data-new-line")).toBeLessThan(on.indexOf('aria-labelledby="coverage-title"'));
    expect(renderToStaticMarkup(createElement(RiskCard, { result: r }))).not.toContain("data-new-line");
    expect(renderToStaticMarkup(createElement(RiskCard, { result: null, showNew: true }))).not.toContain("data-new-line");
  });

  it("CheckForm claims once per page and shows the line only on the result that claimed it", () => {
    const src = readFileSync(new URL("../components/CheckForm.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/if \(!newClaimed\.current\) \{\s*newClaimed\.current = true;\s*if \(claimNewLine\(\)\) setNewFor\(next\.checkedAt\);/);
    expect(src).toContain("showNew={result !== null && result.checkedAt === newFor}");
    expect(src).not.toMatch(/localStorage/);
  });
});

describe("privacy page names the flag (H2f follow-up)", () => {
  it("/about says what the browser keeps for the New line", () => {
    const about = readFileSync(new URL("../app/about/page.tsx", import.meta.url), "utf8");
    const privacy = about.slice(about.indexOf('<Section id="privacy"'), about.indexOf('<Section id="graph"'));
    expect(privacy).toMatch(/one flag in this tab&apos;s session storage/);
    expect(privacy).toContain("It holds no text and is gone when the tab closes.");
  });
});
