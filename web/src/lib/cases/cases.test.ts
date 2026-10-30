import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { localDb } from "../../test-support/pglite";
import { identifierHash } from "../reports/privacy";
import { reportedFor, type ReportsConfig } from "../reports/service";
import { extractIdentifiers } from "../identifiers";
import { MemoryUsageStore } from "../usage";
import { deleteCodeHash, isWellFormedDeleteCode, newDeleteCode, normaliseDeleteCode } from "./delete-code";
import { redactExcerpt } from "./redact";
import { caseResponse, deleteCaseResponse, feedbackResponse } from "./routes";
import { CASES_UNAVAILABLE, CaseRequest, FeedbackRequest } from "./schema";
import { caseMonth, deleteCase, feedbackFor, rulesKey, submitCase, submitFeedback } from "./service";

// PGlite suite: explicit timeouts (see usage.test.ts); no assertion is relaxed.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const PEPPER = "test-pepper-0123456789";
const env = { REPORT_HASH_PEPPER: PEPPER, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" };
const UPI = "zzdemo.case@okdemo";
const TG = "@zzdemo_case_desk";
const EXCERPT = "Pay 4999 to zzdemo.case@okdemo now or call +91 98765 43210, see https://claim.example.com/x and wallet 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

const cfgFor = (db: ReportsConfig["db"]): ReportsConfig => ({ db, pepper: PEPPER, maxPerDay: 5 });
const req = (over: Partial<CaseRequest> = {}): CaseRequest =>
  CaseRequest.parse({ identifiers: [{ type: "upi", value: UPI }, { type: "telegram", value: TG }], category: "task_job", channel: "telegram", lossBand: "lt_10k", ruleIds: ["task_earn"], consent: true, ...over });
const post = (url: string, body: unknown, ip = "198.51.100.10") =>
  new Request(`http://x${url}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const guard = () => ({ store: new MemoryUsageStore(), env: {} });

describe("redactExcerpt (P3)", () => {
  it("replaces every identifier, URL and digit run, and keeps the plain words", () => {
    const out = redactExcerpt(EXCERPT);
    expect(out).toBe("Pay [NUMBER] to [UPI] now or call [PHONE], see [LINK] and wallet [WALLET]");
    for (const leak of ["zzdemo", "98765", "example.com", "0xfB69", "4999"]) expect(out).not.toContain(leak);
  });
  it("covers handles, emails, t.me links and bare domains", () => {
    expect(redactExcerpt("Message @zzdemo_case_desk or t.me/zzdemo_x, mail zzdemo@example.com, site claim-bonus.example.org")).toBe(
      "Message [HANDLE] or [HANDLE], mail [EMAIL], site [LINK]",
    );
  });
  it("is idempotent and caps the text at 500 characters", () => {
    const once = redactExcerpt(EXCERPT);
    expect(redactExcerpt(once)).toBe(once);
    const long = redactExcerpt("word ".repeat(400));
    expect(long.length).toBeLessThanOrEqual(500);
    expect(long.endsWith("…")).toBe(true);
    expect(extractIdentifiers(redactExcerpt(EXCERPT))).toEqual([]);
  });
});

describe("delete codes (P3)", () => {
  it("are 128 random bits shown in groups; only an HMAC with the pepper is stored", () => {
    const a = newDeleteCode();
    expect(a).toMatch(/^([0-9a-f]{4}-){7}[0-9a-f]{4}$/);
    expect(newDeleteCode()).not.toBe(a);
    expect(isWellFormedDeleteCode(a.toUpperCase().replaceAll("-", " "))).toBe(true);
    expect(normaliseDeleteCode(a)).toHaveLength(32);
    expect(deleteCodeHash(PEPPER, a)).toMatch(/^[0-9a-f]{64}$/);
    expect(deleteCodeHash(PEPPER, a)).toBe(deleteCodeHash(PEPPER, a.toUpperCase()));
    expect(deleteCodeHash("another-pepper-0000", a)).not.toBe(deleteCodeHash(PEPPER, a));
  });
});

describe("schemas (P3)", () => {
  it("need consent, a second tick for an excerpt, known enums and at least one identifier", () => {
    expect(CaseRequest.safeParse({ ...req(), consent: false }).success).toBe(false);
    expect(CaseRequest.safeParse({ ...req(), excerpt: "text", excerptConsent: false }).success).toBe(false);
    expect(CaseRequest.safeParse({ ...req(), excerpt: "text", excerptConsent: true }).success).toBe(true);
    expect(CaseRequest.safeParse({ ...req(), channel: "pigeon" }).success).toBe(false);
    expect(CaseRequest.safeParse({ ...req(), identifiers: [] }).success).toBe(false);
    expect(FeedbackRequest.safeParse({ verdict: "genuine", reasons: ["free text"] }).success).toBe(false);
    expect(FeedbackRequest.safeParse({ verdict: "genuine", reasons: ["know_the_person"] }).success).toBe(true);
  });
});

describe("cases and feedback in Postgres (migration 004)", () => {
  it("a case writes reports and links through submit_report, and still needs 2 independent reporters", async () => {
    const { db, pg } = await localDb();
    const cfg = cfgFor(db);
    const a = await submitCase(req(), "fp-a", cfg, { now: new Date("2026-10-30T10:00:00Z") });
    expect(a.ok).toBe(true);
    const upi = extractIdentifiers(UPI);
    expect((await reportedFor(upi, cfg)).entries).toEqual([]); // one reporter: not shown
    expect((await submitCase(req(), "fp-b", cfg)).ok).toBe(true);
    const shown = await reportedFor(upi, cfg);
    expect(shown.entries).toHaveLength(1);
    expect(shown.entries[0].reporters).toBe(2);
    const cases = await pg.query<{ month: string; channel: string; loss_band: string; rule_ids: string[]; excerpt_redacted: string | null; delete_hash: string }>("select * from cases order by created_at");
    expect(cases.rows).toHaveLength(2);
    expect(cases.rows[0]).toMatchObject({ month: "2026-10", channel: "telegram", loss_band: "lt_10k", rule_ids: ["task_earn"], excerpt_redacted: null });
    expect(cases.rows[0].delete_hash).toBe(deleteCodeHash(PEPPER, (a as { deleteCode: string }).deleteCode));
    const edges = await pg.query<{ n: number }>("select count(*)::int n from graph_edges where relation = 'co_reported'");
    expect(edges.rows[0].n).toBe(2); // UPI-Telegram, one row per independent reporter
  });

  it("stores the excerpt only redacted and only with the second tick; unknown rule ids are refused", async () => {
    const { db, pg } = await localDb();
    const cfg = cfgFor(db);
    await submitCase(req({ excerpt: EXCERPT, excerptConsent: true }), "fp-a", cfg);
    await submitCase({ ...req(), excerpt: EXCERPT, excerptConsent: false }, "fp-b", cfg); // the schema refuses this; the service still drops it
    const rows = (await pg.query<{ excerpt_redacted: string | null }>("select excerpt_redacted from cases order by created_at")).rows;
    expect(rows[0].excerpt_redacted).toBe(redactExcerpt(EXCERPT));
    expect(rows[1].excerpt_redacted).toBeNull();
    expect(await submitCase(req({ ruleIds: ["made_up_rule"] }), "fp-c", cfg)).toEqual({ ok: false, reason: "unknown rule id" });
  });

  it("the delete code removes the case and its excerpt; reports stay unless asked, then go with their links", async () => {
    const { db, pg } = await localDb();
    const cfg = cfgFor(db);
    const one = (await submitCase(req({ excerpt: EXCERPT, excerptConsent: true }), "fp-a", cfg)) as { deleteCode: string };
    const two = (await submitCase(req(), "fp-b", cfg)) as { deleteCode: string };
    expect(await deleteCase({ code: newDeleteCode(), removeReports: true }, cfg)).toEqual({ ok: true, deleted: 0, reportsRemoved: 0 });
    expect(await deleteCase({ code: "not-a-code-at-all-0000", removeReports: true }, cfg)).toEqual({ ok: true, deleted: 0, reportsRemoved: 0 });
    expect(await deleteCase({ code: one.deleteCode, removeReports: false }, cfg)).toEqual({ ok: true, deleted: 1, reportsRemoved: 0 });
    expect((await pg.query<{ n: number }>("select count(*)::int n from reports")).rows[0].n).toBe(4);
    expect((await pg.query<{ n: number }>("select count(*)::int n from cases where excerpt_redacted is not null")).rows[0].n).toBe(0);
    expect(await deleteCase({ code: one.deleteCode, removeReports: true }, cfg)).toEqual({ ok: true, deleted: 0, reportsRemoved: 0 }); // already gone
    expect(await deleteCase({ code: two.deleteCode.toUpperCase(), removeReports: true }, cfg)).toEqual({ ok: true, deleted: 1, reportsRemoved: 2 });
    expect((await pg.query<{ n: number }>("select count(*)::int n from reports where reporter_fingerprint_hash = 'fp-b'")).rows[0].n).toBe(0);
  });

  it("purge_expired_cases removes expired cases, excerpts whose reports are gone, and old feedback", async () => {
    const { db, pg } = await localDb();
    const cfg = cfgFor(db);
    await submitCase(req({ excerpt: EXCERPT, excerptConsent: true }), "fp-a", cfg);
    await submitCase(req({ excerpt: EXCERPT, excerptConsent: true }), "fp-b", cfg);
    await pg.query("update cases set expires_at = now() - interval '1 day' where submission_id in (select submission_id from reports where reporter_fingerprint_hash = 'fp-a')");
    await pg.query("delete from reports where reporter_fingerprint_hash = 'fp-b'"); // a moderator upheld a contest
    await submitFeedback({ identifiers: [{ type: "upi", value: UPI }], verdict: "scam", reasons: [], ruleIds: [] }, "fp-a", cfg);
    await pg.query("update feedback set created_at = now() - interval '91 days'");
    const [row] = await db.call<{ cases_deleted: number; excerpts_cleared: number; feedback_deleted: number }>("purge_expired_cases", {});
    expect(row).toEqual({ cases_deleted: 1, excerpts_cleared: 1, feedback_deleted: 1 });
  });

  it("feedback: one answer per network per identifier, counts for display, rules key without identifiers", async () => {
    const { db, pg } = await localDb();
    const cfg = cfgFor(db);
    const ids = [{ type: "upi" as const, value: UPI }];
    await submitFeedback({ identifiers: ids, verdict: "scam", reasons: ["asked_to_pay"], ruleIds: ["task_earn"] }, "fp-a", cfg);
    await submitFeedback({ identifiers: ids, verdict: "genuine", reasons: ["own_id_or_business"], ruleIds: [] }, "fp-a", cfg); // replaces
    await submitFeedback({ identifiers: ids, verdict: "genuine", reasons: ["know_the_person"], ruleIds: [] }, "fp-b", cfg);
    await submitFeedback({ identifiers: [], verdict: "unsure", reasons: [], ruleIds: ["urgency_deadline", "fake_kyc"] }, "fp-a", cfg);
    expect((await pg.query<{ n: number }>("select count(*)::int n from feedback")).rows[0].n).toBe(3); // UPI x2 networks, rules key x1
    expect((await pg.query<{ identifier_hash: string }>("select identifier_hash from feedback where verdict = 'unsure'")).rows[0].identifier_hash).toBe(rulesKey(["urgency_deadline", "fake_kyc"]));
    const f = await feedbackFor(extractIdentifiers(UPI), cfg);
    expect(f).toEqual({ status: "ok", entries: [{ display: expect.stringMatching(/okdemo$/), scam: 0, genuine: 2, unsure: 0, genuineReasons: ["know_the_person", "own_id_or_business"] }] });
    expect(await submitFeedback({ identifiers: [], verdict: "scam", reasons: [], ruleIds: ["nope_rule"] }, "fp-c", cfg)).toEqual({ ok: false, reason: "unknown rule id" });
  });

  it("case_trail_summary counts linked cases only once an identifier has 2 independent reporters; synthetic apart", async () => {
    const { db } = await localDb();
    const cfg = cfgFor(db);
    const hash = identifierHash(PEPPER, "upi", UPI);
    await submitCase(req({ channel: "whatsapp", lossBand: "gt_1l" }), "fp-a", cfg, { synthetic: true });
    expect(await db.call("case_trail_summary", { p_hashes: [hash] })).toEqual([]);
    await submitCase(req(), "fp-b", cfg, { now: new Date("2026-09-15T00:00:00Z") });
    const [t] = await db.call<Record<string, unknown>>("case_trail_summary", { p_hashes: [hash] });
    expect(t).toMatchObject({ identifier_hash: hash, cases: 2, reporters: 2, synthetic_cases: 1, real_cases: 1 });
    expect(t.channels).toEqual({ telegram: 1, whatsapp: 1 });
    expect(t.loss_bands).toEqual({ gt_1l: 1, lt_10k: 1 });
    expect(Object.keys(t.months as object).sort()).toEqual(["2026-09", caseMonth(new Date())].sort());
    expect(JSON.stringify(t)).not.toMatch(/excerpt|fp-a|fp-b/);
  });

  it("before migration 004: writes say unavailable, reads are empty, and the routes answer 503 with the plain sentence", async () => {
    const { db } = await localDb({ migrations: false });
    const cfg = cfgFor(db);
    expect(await submitCase(req(), "fp-a", cfg)).toEqual({ ok: false, reason: "cases_unavailable" });
    expect(await deleteCase({ code: newDeleteCode(), removeReports: false }, cfg)).toEqual({ ok: false, reason: "cases_unavailable" });
    expect(await feedbackFor(extractIdentifiers(UPI), cfg)).toEqual({ status: "unavailable", entries: [] });
    const res = await caseResponse(post("/api/case", req()), { env, db, guard: guard() });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: CASES_UNAVAILABLE });
  });
});

describe("routes (P3): limits, no echo, delete code once, excerpt never returned or logged", () => {
  it("POST /api/case returns the delete code once and nothing of the input; delete and feedback work", async () => {
    const { db, pg } = await localDb();
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((m: string) => void logs.push(String(m)));
    try {
      const body = { ...req(), excerpt: EXCERPT, excerptConsent: true };
      const res = await caseResponse(post("/api/case", body), { env, db, guard: guard() });
      expect(res.status).toBe(200);
      const j = (await res.json()) as { ok: boolean; stored: number; graph: string; deleteCode: string };
      expect(Object.keys(j).sort()).toEqual(["deleteCode", "graph", "ok", "stored"]);
      expect(isWellFormedDeleteCode(j.deleteCode)).toBe(true);
      const stored = (await pg.query<{ excerpt_redacted: string }>("select excerpt_redacted from cases")).rows[0].excerpt_redacted;
      const responses = [
        JSON.stringify(j),
        await (await feedbackResponse(post("/api/feedback", { identifiers: [{ type: "upi", value: UPI }], verdict: "scam", reasons: ["lost_money"] }), { env, db, guard: guard() })).text(),
        await (await deleteCaseResponse(post("/api/case/delete", { code: j.deleteCode, removeReports: true }), { env, db, guard: guard() })).text(),
        await (await caseResponse(post("/api/case", { ...req(), ruleIds: ["bogus_rule"] }), { env, db, guard: guard() })).text(),
        await (await caseResponse(post("/api/case", { ...req(), consent: false }), { env, db, guard: guard() })).text(),
      ];
      expect(responses[2]).toBe(JSON.stringify({ ok: true, deleted: 1, reportsRemoved: 2 }));
      for (const text of [...responses, ...logs]) {
        expect(text).not.toContain(stored);
        expect(text).not.toContain("[UPI]");
        for (const leak of [UPI, "zzdemo", "Pay 4999"]) expect(text).not.toContain(leak);
      }
      expect(logs.some((l) => l.includes('"event":"case"'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("the case and feedback routes have their own daily limits (429 with Retry-After)", async () => {
    const { db } = await localDb();
    const g = { store: new MemoryUsageStore(), env: { USAGE_CASE_PER_DAY: "1", USAGE_FEEDBACK_PER_DAY: "1" } };
    expect((await caseResponse(post("/api/case", req()), { env, db, guard: g })).status).toBe(200);
    const second = await caseResponse(post("/api/case", req()), { env, db, guard: g });
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
    expect((await feedbackResponse(post("/api/feedback", { verdict: "unsure" }), { env, db, guard: g })).status).toBe(200);
    expect((await feedbackResponse(post("/api/feedback", { verdict: "unsure" }), { env, db, guard: g })).status).toBe(429);
  });

  it("no other code reads the excerpt column: only the migration and the case service mention it", () => {
    const web = new URL("../../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const files = ["src", "scripts", "db"]
      .flatMap((d) => walk(join(web, d)))
      .filter((f) => readFileSync(f, "utf8").includes("excerpt_redacted"))
      .map((f) => relative(web, f).replaceAll("\\", "/"));
    expect(files.sort()).toEqual(["db/migrations/004_cases_and_feedback.sql", "src/lib/cases/cases.test.ts"].sort());
    expect(readFileSync(new URL("./service.ts", import.meta.url), "utf8")).not.toContain("excerpt_redacted");
  });
});
