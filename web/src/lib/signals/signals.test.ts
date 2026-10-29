import { describe, expect, it } from "vitest";
import { detectSignals } from "./index";
import { runRules } from "./regex";
import { RULES } from "./rules";
import { locateQuote, validateAiItems } from "./validate";

const ruleIds = (t: string) => [...new Set(runRules(t).map((s) => s.rule_id))];

describe("rule list", () => {
  it("has at least 15 rules with unique ids", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  // Synthetic example per rule (illustrative, not real messages).
  const positives: Record<string, string> = {
    guaranteed_returns: "Join now, guaranteed returns of 3% daily on USDT.",
    withdrawal_fee: "Your profit is ready but you must pay the withdrawal fee of 18% first.",
    urgency_deadline: "Complete payment within 30 minutes or your account will be blocked.",
    seed_phrase_request: "To verify your wallet please send your 12-word recovery phrase.",
    otp_pin_request: "Sir please share the OTP you just received to cancel the order.",
    move_platform: "Let's continue this chat on Telegram, add me there.",
    remote_access_app: "Download AnyDesk and give me the code so I can help you.",
    authority_impersonation: "This is Inspector Sharma from Mumbai Police cyber cell.",
    digital_arrest: "You are under digital arrest, stay on the video call until we finish.",
    fake_kyc: "Dear customer your KYC has expired, account will be suspended.",
    fake_refund: "To get your refund of Rs 4,999 scan the QR and enter UPI PIN.",
    task_earn: "Simple job: like YouTube videos and earn ₹150 per task.",
    romance_investment: "Good morning my love, I made big profit on this crypto platform, you should try.",
    third_party_account: "Please send the amount to my manager's account, details below.",
    small_amount_first: "Send a small amount first to check the transfer works.",
    fake_profit_proof: "See these screenshots of profit from our VIP members.",
    prize_lottery: "Congratulations! You have won the KBC lucky draw of 25 lakh.",
    utility_disconnection: "Your electricity will be disconnected tonight at 9.30 pm.",
  };

  it("every rule has a positive example", () => {
    expect(Object.keys(positives).sort()).toEqual(RULES.map((r) => r.id).sort());
  });
  it.each(Object.entries(positives))("%s fires on its example", (id, text) => {
    expect(ruleIds(text)).toContain(id);
  });
  it("every rule-pass quote is an exact substring at its offsets", () => {
    for (const text of Object.values(positives)) {
      for (const s of runRules(text)) expect(text.slice(s.start, s.end)).toBe(s.quote);
    }
  });
});

describe("hard negatives produce no signals", () => {
  it.each([
    "HDFC Bank: Rs 2,000 debited from a/c XX1234 on 28-10-26. Never share your OTP, PIN or CVV with anyone.",
    "Binance will never ask for your seed phrase or private key. Withdrawals on TRC20 will be suspended for maintenance.",
    "Bro can you send me 500 on GPay? rahul@okaxis. Will return on Monday.",
    "SBI never asks you to install AnyDesk or any screen sharing app.",
    "Meeting moved to 4 pm, see you there.",
  ])("%s", (text) => {
    expect(runRules(text)).toEqual([]);
  });
});

describe("AI validation (AI proposes, code disposes)", () => {
  const text = "Sir,  your KYC\nhas expired.  Pay the release fee today.";

  it("drops a hallucinated quote that is not in the input", () => {
    const r = validateAiItems({ signals: [{ rule_id: "fake_kyc", quote: "your PAN card is blocked" }] }, text);
    expect(r).toEqual({ signals: [], dropped: 1 });
  });
  it("drops an unknown rule_id even with a real quote", () => {
    const r = validateAiItems({ signals: [{ rule_id: "made_up_rule", quote: "Pay the release fee" }] }, text);
    expect(r).toEqual({ signals: [], dropped: 1 });
  });
  it("drops malformed items and too-short quotes", () => {
    const r = validateAiItems({ signals: [{ rule_id: "fake_kyc" }, "junk", { rule_id: "fake_kyc", quote: "a" }] }, text);
    expect(r.dropped).toBe(3);
  });
  it("accepts a quote that matches after whitespace normalisation and re-cuts it from the input", () => {
    const r = validateAiItems({ signals: [{ rule_id: "fake_kyc", quote: "your KYC has expired" }] }, text);
    expect(r.dropped).toBe(0);
    const s = r.signals[0];
    expect(s.quote).toBe("your KYC\nhas expired");
    expect(text.slice(s.start, s.end)).toBe(s.quote);
    expect(s.source).toBe("ai");
  });
  it("locateQuote returns null for absent text", () => {
    expect(locateQuote("hello world", "goodbye")).toBeNull();
  });
});

describe("detectSignals", () => {
  it("without an LLM key the AI pass is 'unavailable' and rule signals still work", async () => {
    const r = await detectSignals("Pay the withdrawal fee now", { env: {} });
    expect(r.ai.status).toBe("unavailable");
    expect(r.signals.map((s) => s.rule_id)).toEqual(["withdrawal_fee"]);
  });
  it("merges AI signals, dropping invalid ones and counting them", async () => {
    const text = "Hello dear, invest with me";
    const complete = async () =>
      JSON.stringify({
        signals: [
          { rule_id: "romance_investment", quote: "dear, invest with me" },
          { rule_id: "guaranteed_returns", quote: "guaranteed 10x" },
        ],
      });
    const r = await detectSignals(text, { env: { OPENAI_MODEL: "test-model" }, complete });
    expect(r.ai).toMatchObject({ status: "ok", dropped: 1 });
    expect(r.signals).toEqual([
      { rule_id: "romance_investment", label: expect.any(String), quote: "dear, invest with me", start: 6, end: 26, source: "ai" },
    ]);
  });
  it("LLM returning non-JSON is 'unavailable', not a crash", async () => {
    const r = await detectSignals("hi", { env: { OPENAI_MODEL: "m" }, complete: async () => "not json" });
    expect(r.ai.status).toBe("unavailable");
  });
});
