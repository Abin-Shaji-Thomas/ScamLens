import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage from "../app/about/page";
import { metadata } from "../app/layout";
import PrivacyPage from "../app/privacy/page";
import { SiteFooter } from "../components/SiteFooter";
import { CONTACT_EMAIL, CONTACT_MAILTO, X_HANDLE, X_URL } from "./contact";

const WEB = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("public contact (P7b)", () => {
  it("is the owner-provided address and handle, with a well-formed mailto", () => {
    expect(CONTACT_EMAIL).toBe("scamlenspvt@gmail.com");
    expect(X_URL).toBe("https://x.com/scamlens");
    expect(X_HANDLE).toBe("@scamlens");
    expect(CONTACT_MAILTO).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]+$/);
  });

  it("the footer (on every page through the layout) links Contact and the X handle with 44 px taps; only X opens a new tab", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));
    const email = html.match(/<a[^>]*data-contact-email[^>]*>/)?.[0] ?? "";
    const x = html.match(/<a[^>]*data-contact-x[^>]*>/)?.[0] ?? "";
    expect(email).toContain(`href="${CONTACT_MAILTO}"`);
    expect(email).not.toContain("target=");
    expect(x).toContain(`href="${X_URL}"`);
    expect(x).toContain('target="_blank"');
    expect(x).toContain('rel="noopener noreferrer"');
    for (const tag of [email, x]) expect(tag).toContain("min-h-11");
    expect(html.match(/target="_blank"/g)).toHaveLength(1);
    expect(strip(html)).toContain(`${X_HANDLE} on X`);
    expect(readFileSync(join(WEB, "src/app/layout.tsx"), "utf8")).toContain("<SiteFooter />");
  });

  it("print keeps the footer contact: the footer is not hidden in print and the address is printed in black", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toMatch(/<footer class="mt-auto">/);
    const email = html.match(/<a[^>]*data-contact-email[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    expect(email).not.toContain("print:hidden");
    expect(email).toContain("text-swiss-black");
    expect(email).toContain(`<span class="hidden print:inline">: ${CONTACT_EMAIL}</span>`);
  });

  it("/about has a Contact section with what to write about and the 1930 line, and promises no response time", () => {
    const html = renderToStaticMarkup(createElement(AboutPage));
    const section = html.slice(html.indexOf('<section id="contact"'));
    expect(section).toContain(`href="${CONTACT_MAILTO}"`);
    expect(section).toContain(`href="${X_URL}"`);
    const text = strip(section);
    for (const w of ["corrections", "report or contest requests", "deletion requests", "feedback"]) expect(text).toContain(w);
    expect(text).toContain("ScamLens cannot recover money. If you lost money, call 1930 now and tell your bank.");
    expect(text).not.toMatch(/within \d|\d+ (hours|days)|we will reply|respond(s)? within/i);
  });

  it("/privacy names the address for questions, deletion or contest requests; Twitter metadata names the handle", () => {
    expect(strip(renderToStaticMarkup(createElement(PrivacyPage)))).toMatch(new RegExp(`Questions, deletion or contest requests: ${CONTACT_EMAIL.replace(/\./g, "\\.")} \\.`));
    expect(metadata.twitter).toMatchObject({ site: X_HANDLE, creator: X_HANDLE, card: "summary_large_image" });
  });

  it("no source file hard-codes the address or the X link except contact.ts (tests compare against it)", () => {
    const offenders = ["src", "scripts"]
      .flatMap((d) => walk(join(WEB, d)))
      .filter((f) => !f.endsWith(".test.ts") && !f.endsWith("contact.ts"))
      .filter((f) => /\.(ts|tsx|css|json|md)$/.test(f))
      .filter((f) => /scamlenspvt@|x\.com\/scamlens/.test(readFileSync(f, "utf8")))
      .map((f) => relative(WEB, f));
    expect(offenders).toEqual([]);
  });

  it("the committer's personal email (read from git config, never written here) appears in no tracked file", () => {
    const git = (args: string[]) => execFileSync("git", args, { cwd: join(WEB, ".."), encoding: "utf8" }).trim();
    let personal = "";
    try {
      personal = git(["config", "user.email"]).toLowerCase();
    } catch {
      personal = "";
    }
    if (!personal || personal === "scamlenspvt@gmail.com") return; // nothing to compare against (CI)
    const local = personal.split("@")[0];
    const files = git(["ls-files"]).split("\n").filter((f) => f && !/\.(png|ico|pdf)$/.test(f));
    const hits = files.filter((f) => readFileSync(join(WEB, "..", f), "utf8").toLowerCase().includes(local));
    expect(hits).toEqual([]);
  });
});

describe("the contact never enters a receipt, an evidence pack or a log (P7b)", () => {
  it("evidence pack and receipt carry no contact address", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const { runCheck } = await import("./check");
    const { buildEvidencePack } = await import("./evidence-pack");
    const { receiptFor } = await import("./receipts");
    const offline = { fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch, timeoutMs: 20, now: () => new Date(), env: {}, db: null };
    const r = await runCheck({ text: "pay zzdemo.agent@okdemo now" }, offline);
    const env = { RECEIPT_SIGNING_KEY: generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64") };
    const receipt = receiptFor(r, "pay zzdemo.agent@okdemo now", env, "abc1234")!;
    for (const s of [buildEvidencePack({ ...r, receipt }), JSON.stringify(receipt)]) {
      expect(s).not.toContain(CONTACT_EMAIL);
      expect(s).not.toContain(X_URL);
    }
    expect(readFileSync(join(WEB, "src/lib/log.ts"), "utf8")).not.toMatch(/contact/i);
  });
});
