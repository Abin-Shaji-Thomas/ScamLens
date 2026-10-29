import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage from "../app/about/page";
import { SiteFooter } from "../components/SiteFooter";
import { MIN_INDEPENDENT_REPORTERS, REPORT_RETENTION_DAYS } from "./limits";
import { NO_REPORTS_MESSAGE } from "./risk";
import { usageLimits } from "./usage";
import { EVM_CHAINS } from "./verified/etherscan";
import { ofacList, scamSnifferList } from "./verified/lists";

const html = renderToStaticMarkup(createElement(AboutPage));
const text = html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const APP = join(import.meta.dirname, "..", "app");

describe("/about", () => {
  it("states what ScamLens is not, and the emergency steps", () => {
    expect(text).toMatch(/never gives a verdict/);
    expect(text).toMatch(/not legal or financial advice/);
    expect(text).toContain("1930");
    expect(html).toContain('href="https://cybercrime.gov.in"');
    expect(text).toMatch(/Tell your bank immediately/);
    expect(text).toContain(NO_REPORTS_MESSAGE);
  });

  it("numbers come from code constants and snapshot metadata", () => {
    expect(text).toContain(`at least ${MIN_INDEPENDENT_REPORTERS} different fingerprints`);
    expect(text).toContain(`within ${REPORT_RETENTION_DAYS} days`);
    expect(text).toContain(`at most ${usageLimits({}).contest} entries per day`);
    expect(text).toContain(ofacList().meta.publish_date);
    expect(text).toContain(scamSnifferList().meta.upstream_commit.slice(0, 7));
    for (const c of EVM_CHAINS) expect(text).toContain(c.name);
  });

  it("describes the real independence rule, including the no-accounts caveat", () => {
    expect(text).toMatch(/There are no accounts/);
    expect(text).toMatch(/one person who switches networks .* can count as more than one/);
  });

  it("names licences and attribution", () => {
    expect(text).toMatch(/public domain/);
    expect(text).toMatch(/GPL-3.0/);
    expect(html).toContain('href="https://github.com/scamsniffer/scam-database"');
    expect(text).toMatch(/7 days delayed/);
  });

  it("every link is an existing app route or an https URL", () => {
    const hrefs = [...renderToStaticMarkup(createElement("div", null, createElement(AboutPage), createElement(SiteFooter))).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain("/about");
    for (const h of hrefs) {
      if (h.startsWith("/")) expect(existsSync(join(APP, h === "/" ? "" : h.slice(1), "page.tsx")), h).toBe(true);
      else expect(h).toMatch(/^https:\/\//);
    }
  });
});
