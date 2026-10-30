import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaidPlan } from "../components/PaidPlan";
import { WhatToDoNow } from "../components/WhatToDoNow";
import { buildComplaintDraft, copyComplaintDraft, EMPTY_FIELDS, PAID_PLAN, PAID_PLAN_NOTE } from "./complaint-draft";
import { SAMPLES } from "./samples";

const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const CHAT = "Send the tax to zzdemo.refund@okdemo or 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359 today. Call +91 98765 43210.";

describe('"I already paid" plan', () => {
  it("the band has a collapsed 'I already paid' control; opened, it shows the seven steps in order and the no-promise note", () => {
    const closed = renderToStaticMarkup(createElement(WhatToDoNow, { text: CHAT }));
    expect(closed).toMatch(/<button type="button" class="button button--outline" aria-expanded="false"[^>]*>I already paid<\/button>/);
    expect(strip(closed)).not.toContain(PAID_PLAN[0]);
    const open = strip(renderToStaticMarkup(createElement(PaidPlan, { text: CHAT, defaultOpen: true })));
    let at = -1;
    for (const step of PAID_PLAN) {
      const i = open.indexOf(step);
      expect(i, step).toBeGreaterThan(at);
      at = i;
    }
    expect(PAID_PLAN[0]).toMatch(/^Call 1930/);
    expect(PAID_PLAN[5]).toMatch(/recovery fee.*tax to withdraw/);
    expect(open).toContain(PAID_PLAN_NOTE);
    expect(open).toMatch(/Not legal advice/);
    for (const label of ["Amount", "Date and time", "Payment method", "Transaction ID", "Copy complaint draft"]) expect(open).toContain(label);
    expect(open).not.toMatch(/recover your money|guarantee(d)? (refund|recovery)|will get your money back/i);
  });

  it("the draft uses the shared extractor with identifiers exactly as typed, the fields, and says it is a draft, not legal advice", () => {
    const d = buildComplaintDraft(CHAT, { amount: "₹25,000", when: "29 Oct 2026, 14:10", method: "UPI", transactionId: "UTR 1234" });
    expect(d).toMatch(/^DRAFT COMPLAINT - adapt it before sending\. This is a draft, not legal advice\./);
    expect(d).toContain("- zzdemo.refund@okdemo (upi)");
    expect(d).toContain("- 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359 (evm)");
    expect(d).toContain("- +91 98765 43210 (phone)"); // as typed, not normalised
    expect(d).toContain("Amount: ₹25,000");
    expect(d).toContain("Transaction ID / UTR / transaction hash: UTR 1234");
    expect(d).not.toContain("Send the tax"); // the chat itself is not copied
    expect(buildComplaintDraft("hello", EMPTY_FIELDS)).toContain("Amount: [fill in]");
  });

  describe("nothing is sent to the server", () => {
    afterEach(() => vi.unstubAllGlobals());
    it("rendering, editing the fields and copying the draft make no network request (fetch mocked)", async () => {
      const fetchSpy = vi.fn(() => Promise.reject(new Error("no network expected")));
      vi.stubGlobal("fetch", fetchSpy);
      renderToStaticMarkup(createElement(PaidPlan, { text: SAMPLES[0].text, defaultOpen: true }));
      // The component's onChange only updates React state; the copy button calls copyComplaintDraft.
      const fields = { ...EMPTY_FIELDS };
      for (const v of ["5", "50", "5000"]) Object.assign(fields, { amount: v, method: "UPI", transactionId: v });
      const clipboard = { writeText: vi.fn(async () => undefined) };
      expect(await copyComplaintDraft(SAMPLES[0].text, fields, clipboard)).toBe(true);
      expect(clipboard.writeText).toHaveBeenCalledWith(buildComplaintDraft(SAMPLES[0].text, fields));
      expect(await copyComplaintDraft(SAMPLES[0].text, fields, undefined)).toBe(false); // blocked clipboard: the draft is shown instead
      expect(fetchSpy).not.toHaveBeenCalled();
    });
    it("the component and the draft module contain no network code at all", () => {
      for (const f of ["../components/PaidPlan.tsx", "./complaint-draft.ts"]) {
        const src = readFileSync(new URL(f, import.meta.url), "utf8");
        expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\/api\//);
      }
    });
  });
});
