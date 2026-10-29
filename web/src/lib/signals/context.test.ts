import { describe, expect, it } from "vitest";
import { runCheck, type RunDeps } from "../check";
import { inWarningContext } from "./context";
import { runRules } from "./regex";

const deps: RunDeps = {
  fetch: (() => Promise.reject(new Error("offline"))) as typeof fetch,
  timeoutMs: 20,
  now: () => new Date("2026-10-29T00:00:00Z"),
  env: {},
  db: null,
};
const check = (text: string) => runCheck({ text }, deps);
const counted = (r: Awaited<ReturnType<typeof check>>) => r.suspected.filter((s) => s.context !== "warning").map((s) => s.rule_id);

describe("G3: the 4 known false positives are Low signals", () => {
  it.each([
    ["news article", "News: City police warned residents about fake KYC messages that say your account will be blocked. Officials said such messages often ask people to share the OTP or install AnyDesk."],
    ["police awareness", "Awareness message from the cyber police: there is no such thing as a digital arrest. Police never ask you to stay on a video call or transfer money. If someone does, hang up and call 1930."],
    ["society lucky draw", "Our housing society's festival lucky draw results are out: flat 304 won the hamper. Collect it from the office."],
    ["friend on red flags", "I read that guaranteed returns are a red flag, so I only do a monthly SIP in an index fund."],
  ])("%s", async (_name, text) => {
    const r = await check(text);
    expect(r.risk.level).toBe("low");
    expect(counted(r)).toEqual([]);
  });
  it("warning-context hits are still shown (marked), with a plain reason", async () => {
    const r = await check("I read that guaranteed returns are a red flag, so I only do a monthly SIP in an index fund.");
    expect(r.suspected.map((s) => [s.rule_id, s.context])).toEqual([["guaranteed_returns", "warning"]]);
    expect(r.risk.reasons.join(" ")).toMatch(/only in warning or news-style text .* not counted/);
  });
});

describe("G3 adversarial: a decoy warning cannot switch a scam off", () => {
  it("decoy 'beware of fake sites' sentence + scam claims in a DIFFERENT sentence is still flagged", async () => {
    const r = await check("Beware of fake sites. Guaranteed profit of 5% daily, pay tax to withdraw your balance.");
    expect(r.risk.level).not.toBe("low");
    expect(counted(r)).toEqual(expect.arrayContaining(["guaranteed_returns", "withdrawal_fee"]));
  });
  it("warning word in a separate message (line) does not cover the next message", async () => {
    const r = await check("Stay safe, never share your OTP!\nHi sir, guaranteed returns 4% daily, pay the withdrawal fee first.");
    expect(r.risk.level).not.toBe("low");
    expect(counted(r)).toEqual(expect.arrayContaining(["guaranteed_returns", "withdrawal_fee"]));
  });
  it("a protective phrase in another message does not cover a quote-free continuation", async () => {
    const r = await check("Beware of fraud.\nThey say guaranteed returns of 3% daily are possible, send a small amount first.");
    expect(counted(r)).toEqual(expect.arrayContaining(["guaranteed_returns", "small_amount_first"]));
  });
  it("'Final warning' and 'warning' alone are not protective markers", async () => {
    const r = await check("Final warning: your account will be blocked today. Share the OTP now.");
    expect(counted(r)).toEqual(expect.arrayContaining(["urgency_deadline", "otp_pin_request"]));
  });
  it("Hinglish decoy in another message does not cover the scam", async () => {
    const r = await check("Savdhan rahein!\nSir OTP bata dijiye abhi, account band ho jayega.");
    expect(counted(r)).toEqual(expect.arrayContaining(["otp_pin_request", "urgency_deadline"]));
  });
});

describe("G3 context detection", () => {
  it("same-sentence markers, including Hinglish", () => {
    const t = "Dhyan rahe, OTP kisi ko share mat karna.";
    expect(inWarningContext(t, t.indexOf("OTP"))).toBe(true);
  });
  it("previous sentence counts only when this one continues it", () => {
    const a = "Police advisory: watch for fake calls. They say your SIM will be deactivated today.";
    expect(inWarningContext(a, a.indexOf("your SIM"))).toBe(true);
    const b = "Police advisory: watch for fake calls. Your SIM will be deactivated today.";
    expect(inWarningContext(b, b.indexOf("Your SIM"))).toBe(false);
  });
  it("a quoted example after a warning sentence is warning context", () => {
    const t = "Beware of messages like this. \"Your account will be blocked within 2 hours\" is a common trick.";
    expect(inWarningContext(t, t.indexOf("Your account"))).toBe(true);
  });
});

describe("G3: digital arrest rule narrowed", () => {
  it("advice not to trust such calls is not flagged", () => {
    for (const t of ["There is no such thing as a digital arrest.", "Police never ask you to stay on a video call.", "Do not trust anyone who says you are under digital arrest."]) {
      expect(runRules(t).filter((s) => s.rule_id === "digital_arrest"), t).toEqual([]);
    }
  });
  it("the threat itself still fires, including 'do not tell anyone' (not protective advice)", () => {
    const t = "You are under digital arrest. Stay on the video call and do not tell anyone or an arrest warrant will be issued.";
    expect(runRules(t).filter((s) => s.rule_id === "digital_arrest").length).toBeGreaterThanOrEqual(3);
  });
});

describe("G3: lucky draw guard", () => {
  it("a genuine community draw does not fire; a draw aimed at you or asking for money does", () => {
    expect(runRules("Our society's lucky draw results are out: flat 304 won the hamper.").filter((s) => s.rule_id === "prize_lottery")).toEqual([]);
    expect(runRules("Congratulations, your number was picked in our lucky draw!").some((s) => s.rule_id === "prize_lottery")).toBe(true);
    expect(runRules("Lucky draw winner! Pay the fee to claim the car.").some((s) => s.rule_id === "prize_lottery")).toBe(true);
  });
});

describe("final round: a solicitation in the same sentence defeats the warning marker", () => {
  it("'Never send money to strangers; guaranteed returns are a red flag' stays warning context", async () => {
    const r = await check("Never send money to strangers; guaranteed returns are a red flag.");
    expect(r.suspected.map((s) => [s.rule_id, s.context])).toEqual([["guaranteed_returns", "warning"]]);
    expect(r.risk.level).toBe("low");
  });
  it("'Beware of fake sites, send 5000 USDT now to join our group, guaranteed profit' is NOT warning context", async () => {
    const r = await check("Beware of fake sites, send 5000 USDT now to join our group, guaranteed profit.");
    expect(counted(r)).toContain("guaranteed_returns");
    expect(r.suspected.every((s) => s.context !== "warning")).toBe(true);
    expect(r.risk.level).not.toBe("low");
  });
  it.each([
    ["pay at the start of a clause", "Red flag alert for others, pay the activation fee today and get guaranteed returns."],
    ["you must + verb", "Beware of copycats; you must deposit the processing fee before you can withdraw."],
    ["contact me", "Never trust random agents, contact me for guaranteed returns of 3% daily."],
    ["Hinglish imperative", "Savdhan rahiye, pehle 500 bhejo aur roz ka munafa pakka."],
  ])("%s is flagged", async (_n, text) => {
    const r = await check(text);
    expect(counted(r).length).toBeGreaterThan(0);
    expect(r.risk.level).not.toBe("low");
  });
  it.each([
    ["description, not a request", "News: police said such messages ask people to pay a withdrawal fee before they can withdraw."],
    ["negated in the same clause", "Bank advisory: never pay a processing fee to withdraw your own money."],
    ["Hinglish negated", "Savdhan: kisi ko bhi activation fee mat bhejo, ye fraud hai."],
  ])("%s stays warning context", async (_n, text) => {
    const r = await check(text);
    expect(counted(r)).toEqual([]);
    expect(r.suspected.length).toBeGreaterThan(0);
  });
});

describe("final round: general conditional-awareness marker", () => {
  it("eval v01 (bank advisory 'If someone says ..., it is a fraud call') is Low", async () => {
    const r = await check("Bank advisory: we will never ask you to share your OTP, PIN or CVV. If someone says your account will be blocked unless you pay, it is a fraud call.");
    expect(counted(r)).toEqual([]);
    expect(r.risk.level).toBe("low");
  });
  it.each([
    ["English variant", "If anyone tells you that your KYC has expired and asks for a link click, that's a scam."],
    ["Hinglish variant", "Agar koi kahe ki aapka account band ho jayega, to ye fraud hai."],
  ])("%s is warning context", async (_n, text) => {
    const r = await check(text);
    expect(counted(r)).toEqual([]);
  });
  it.each([
    ["threat with a condition", "If you do not pay the clearance fee within 2 hours, police will arrest you."],
    ["decoy 'if someone says this is a fraud' plus a request", "If someone says this is a fraud, ignore them and pay the clearance fee within 2 hours."],
    ["Hinglish threat", "Agar aapne 2 ghante mein fee nahi bhari, to account band ho jayega."],
  ])("%s is still flagged", async (_n, text) => {
    const r = await check(text);
    expect(counted(r).length).toBeGreaterThan(0);
    expect(r.risk.level).not.toBe("low");
  });
});
