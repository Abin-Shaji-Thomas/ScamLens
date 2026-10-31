import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AboutPage from "../app/about/page";
import PrivacyPage from "../app/privacy/page";
import { CheckForm, DESCRIBE_NOTE } from "../components/CheckForm";
import { feedbackLine } from "../components/ReportedList";
import { RiskCard } from "../components/RiskCard";
import { SiteFooter } from "../components/SiteFooter";
import { localDb } from "../test-support/pglite";
import { caseBody, countedRuleIds, excerptPreview, feedbackBody } from "./cases/client";
import { CaseRequest, FeedbackRequest } from "./cases/schema";
import { submitFeedback } from "./cases/service";
import { runCheck, type RunDeps } from "./check";
import { extractIdentifiers } from "./identifiers";
import { STORAGE_PROMISE } from "./privacy-copy";
import { fingerprintHash } from "./reports/privacy";
import { submitReport } from "./reports/service";
import { SAMPLES } from "./samples";
import { SCAM_TYPE_LABEL, SCAM_TYPES } from "./scam-types";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const offline: RunDeps = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date("2026-10-30T10:00:00Z"), env: {}, db: null };
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const TEXT = "News: police warn about this. Your KYC has expired, share the OTP now and pay zzdemo.kyc.update@okdemo or call +91 98765 43210.";

describe("form wording and Common scams in India (P6a, P6b)", () => {
  it("the box asks for a message or a description, with the honest note", () => {
    const html = strip(renderToStaticMarkup(createElement(CheckForm)));
    expect(html).toContain("Paste a message, or describe what happened");
    expect(html).toContain(DESCRIBE_NOTE);
    expect(DESCRIBE_NOTE).toBe("Works best with the actual message text; descriptions are checked with the same fixed patterns.");
  });
  it("five named examples, labelled, linked to their sources, next to the existing three samples", () => {
    const html = renderToStaticMarkup(createElement(CheckForm));
    expect(SCAM_TYPES.map((s) => s.name)).toEqual(["Digital arrest", "Telegram task job", "Fake KYC / bank block", "Crypto investment group", 'P2P "bank freeze"']);
    expect(html.match(/data-scam-type="/g)).toHaveLength(5);
    expect(strip(html)).toContain(SCAM_TYPE_LABEL);
    expect(html).toContain('href="/about#scam-types"');
    for (const s of SAMPLES) expect(strip(html)).toContain(s.title);
  });
  it("every example uses demo identifiers only, triggers at least one pattern, and cites an https page with a date", async () => {
    const { runRules } = await import("./signals/regex");
    for (const s of SCAM_TYPES) {
      for (const id of extractIdentifiers(s.example)) {
        if (id.type === "upi") expect(id.value).toMatch(/^zzdemo\./);
        else if (id.type === "telegram") expect(id.value).toMatch(/^@zzdemo_/);
        else if (id.type === "domain") expect(id.value).toMatch(/\.example\.(com|net|org)$/);
        else throw new Error(`unexpected ${id.type} in ${s.id}`);
      }
      expect(runRules(s.example).length, s.id).toBeGreaterThan(0);
      expect(s.source.url).toMatch(/^https:\/\//);
      expect(s.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("/about#scam-types lists each type with its source link, and claims no ranking", () => {
    const html = renderToStaticMarkup(createElement(AboutPage));
    expect(html).toContain('id="scam-types"');
    expect(html.match(/data-scam-source="/g)).toHaveLength(5);
    for (const s of SCAM_TYPES) expect(html).toContain(`href="${s.source.url.replace(/&/g, "&amp;")}"`);
    expect(strip(html)).toContain("They say nothing about how common each type is.");
  });
});

describe("Was this right? and add it to the map (P6c)", () => {
  it("request bodies: raw identifiers, counted rules only, and an excerpt only after both ticks", async () => {
    const r = await runCheck({ text: TEXT }, offline);
    expect(countedRuleIds(r)).toEqual(expect.arrayContaining(["fake_kyc", "otp_pin_request"]));
    const fb = feedbackBody(r, "genuine", ["know_the_person", "know_the_person"]);
    expect(FeedbackRequest.parse(fb)).toEqual({ identifiers: [{ type: "upi", value: "zzdemo.kyc.update@okdemo" }, { type: "phone", value: "+91 98765 43210" }], verdict: "genuine", reasons: ["know_the_person"], ruleIds: countedRuleIds(r) });
    const base = { category: "kyc_refund" as const, channel: "sms" as const, lossBand: "unknown" as const, consent: true };
    expect(caseBody(r, TEXT, { ...base, includeExcerpt: false, excerptConsent: false })).not.toHaveProperty("excerpt");
    expect(caseBody(r, TEXT, { ...base, includeExcerpt: true, excerptConsent: false })).not.toHaveProperty("excerpt");
    const withExcerpt = CaseRequest.parse(caseBody(r, TEXT, { ...base, includeExcerpt: true, excerptConsent: true }));
    expect(withExcerpt.excerpt).toBe(excerptPreview(TEXT));
    expect(withExcerpt.excerpt).not.toMatch(/zzdemo|98765/);
  });
  it("a real result shows both panels; synthetic samples and a result without identifiers do not offer contributing", async () => {
    const r = await runCheck({ text: TEXT }, offline);
    const html = renderToStaticMarkup(createElement(RiskCard, { result: r, text: TEXT }));
    expect(html).toContain("data-feedback");
    expect(strip(html)).toContain("Was this right?");
    expect(strip(html)).toContain("This was a real scam, add it to the map");
    expect(html).toMatch(/<form class="[^"]*print:hidden[^"]*" data-feedback/);
    const demo = renderToStaticMarkup(createElement(RiskCard, { result: r, demo: true, text: TEXT }));
    expect(demo).not.toContain("data-feedback");
    expect(strip(demo)).not.toContain("add it to the map");
    const noIds = await runCheck({ text: "share the OTP now" }, offline);
    expect(strip(renderToStaticMarkup(createElement(RiskCard, { result: noIds })))).not.toContain("add it to the map");
  });
  it("feedback counts are shown next to a Reported entry and never change the level", async () => {
    expect(feedbackLine({ reporters: 3 }, { display: "x", scam: 1, genuine: 2, unsure: 0, genuineReasons: ["own_id_or_business"] })).toBe(
      "3 reported, 2 marked genuine (it is my own id or business), 1 marked scam. Shown for information; it does not change the level.",
    );
    expect(feedbackLine({ reporters: 3 }, undefined)).toBeNull();
    const { db } = await localDb();
    const cfg = { db, pepper: "test-pepper-0123456789", maxPerDay: 5 };
    const env = { REPORT_HASH_PEPPER: cfg.pepper };
    for (const ip of ["198.51.100.1", "198.51.100.2"]) await submitReport({ identifiers: [{ type: "upi", value: "zzdemo.shop@okdemo" }], category: "other", consent: true }, fingerprintHash(cfg.pepper, ip), cfg);
    const text = "please pay zzdemo.shop@okdemo";
    const before = await runCheck({ text }, { ...offline, env, db });
    for (const ip of ["198.51.100.3", "198.51.100.4", "198.51.100.5"]) await submitFeedback({ identifiers: [{ type: "upi", value: "zzdemo.shop@okdemo" }], verdict: "genuine", reasons: ["own_id_or_business"], ruleIds: [] }, fingerprintHash(cfg.pepper, ip), cfg);
    const after = await runCheck({ text }, { ...offline, env, db });
    expect(after.feedback?.entries[0]).toMatchObject({ genuine: 3 });
    expect(after.risk).toEqual(before.risk);
    expect(strip(renderToStaticMarkup(createElement(RiskCard, { result: after })))).toContain("2 reported, 3 marked genuine (it is my own id or business).");
  });
});

describe("/privacy (P6e)", () => {
  it("shows the promise, the inventory and the delete form; the footer links to it on every page", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(strip(html)).toContain(STORAGE_PROMISE);
    expect(html).toContain('id="delete"');
    expect(html).toContain("data-delete-case");
    expect(strip(html)).toContain("Also remove my reports and links from this case");
    expect(strip(html)).toContain("The moderator only; never shown on the site, in receipts, evidence packs or logs");
    const footer = renderToStaticMarkup(createElement(SiteFooter));
    expect(footer).toMatch(/<a[^>]*href="\/privacy"[^>]*>Privacy<\/a>/);
  });
});
