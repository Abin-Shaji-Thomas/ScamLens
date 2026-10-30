import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LinkHintsView } from "../../components/LinkHints";
import type { CheckResponse } from "../api-schema";
import { DEMO_LABEL } from "../demo";
import { extractIdentifiers } from "../identifiers";
import { hintSentence, hintTargets, runLinkHints } from "./link-hints";

const BANNED = /\b(scammer|fraudster|criminal|guilty|confirmed scam)\b/i;
const ids = extractIdentifiers("Pay zzdemo.refund@okdemo or 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359, ask @zz_demo_alpha, call +91 98765 43210");
const entry = (type: string, display: string) => ({ type, display, reporters: 2, categories: ["investment"], firstReported: "2026-10-01", lastReported: "2026-10-02", synthetic: true, contested: false });
const result = (entries: ReturnType<typeof entry>[], status: "ok" | "unavailable" = "ok") =>
  ({ identifiers: ids, reported: { status, entries } }) as unknown as CheckResponse;
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const view = (others: number, synthetic = true) => ({ status: "ok", nodes: [{ focus: true }, ...Array.from({ length: others }, () => ({ focus: false }))], synthetic });

describe("linked-identifier hints (G4c)", () => {
  it("targets: only reported identifiers of type upi/evm/tron/telegram, at most 3, none when reports are unavailable", () => {
    const r = result([entry("upi", "zz***d@okdemo"), entry("telegram", "@zz***ha"), entry("phone", "+91 98******10")]);
    expect(hintTargets(r).map((i) => i.type)).toEqual(["upi", "telegram"]); // phone is not a hint type
    expect(hintTargets(result([entry("upi", "zz***d@okdemo")], "unavailable"))).toEqual([]);
    expect(hintTargets(result([]))).toEqual([]);
  });

  it("with links: one plain sentence per identifier, the not-proof note and the demo label", async () => {
    const fetchFn = vi.fn(async () => ok(view(2))) as unknown as typeof fetch;
    const hints = await runLinkHints(hintTargets(result([entry("upi", "zz***d@okdemo")])), fetchFn);
    expect(hints).toEqual([{ type: "upi", display: "zz***d@okdemo", linked: 2, synthetic: true }]);
    expect(hintSentence(hints[0])).toBe("This UPI ID is linked to 2 other identifiers in community reports. Show links to see how.");
    const html = renderToStaticMarkup(createElement(LinkHintsView, { hints })).replace(/<[^>]+>/g, " ");
    expect(html).toContain("This UPI ID is linked to 2 other identifiers in community reports.");
    expect(html).toContain("A link is not proof of wrongdoing.");
    expect(html).toContain(DEMO_LABEL);
    expect(html).not.toMatch(BANNED);
  });

  it("no links: nothing is shown", async () => {
    const fetchFn = vi.fn(async () => ok(view(0))) as unknown as typeof fetch;
    const hints = await runLinkHints(hintTargets(result([entry("upi", "zz***d@okdemo")])), fetchFn);
    expect(hints).toEqual([]);
    expect(renderToStaticMarkup(createElement(LinkHintsView, { hints }))).toBe("");
  });

  it("failure or rate limit: nothing is shown, and a 429 stops further lookups; calls are one at a time", async () => {
    const order: string[] = [];
    let active = 0;
    const fetchFn = vi.fn(async (_u: string, init: RequestInit) => {
      active++;
      expect(active).toBe(1); // sequential
      order.push(JSON.parse(String(init.body)).type);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return order.length === 1 ? ok({ error: "oops" }, 500) : ok({ ok: false }, 429);
    }) as unknown as typeof fetch;
    const r = result([entry("upi", "zz***d@okdemo"), entry("telegram", "@zz***ha"), entry("evm", "0xfB69***d359")]);
    expect(await runLinkHints(hintTargets(r), fetchFn)).toEqual([]);
    expect(order).toEqual(["upi", "evm"]); // stopped after the 429, the telegram lookup never ran
    const throwing = vi.fn(async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(await runLinkHints(hintTargets(r), throwing)).toEqual([]);
    expect(renderToStaticMarkup(createElement(LinkHintsView, { hints: [] }))).toBe("");
  });

  it("the card renders without waiting for hints (nothing on the first render)", async () => {
    const { LinkHints } = await import("../../components/LinkHints");
    expect(renderToStaticMarkup(createElement(LinkHints, { result: result([entry("upi", "zz***d@okdemo")]) }))).toBe("");
  });
});
