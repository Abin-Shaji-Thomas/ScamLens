"use client";

import { useEffect, useRef, useState } from "react";
import { CheckResponse, MAX_INPUT_CHARS } from "@/lib/api-schema";
import { claimNewLine } from "@/lib/new-line";
import type { PatternExample } from "@/lib/pattern-example";
import { SAMPLE_WATERMARK, SAMPLES } from "@/lib/samples";
import { SCREENSHOT_OFF } from "@/lib/screenshot-copy";
import { SCAM_TYPE_LABEL } from "@/lib/scam-types";
import { BeyondTheCheck } from "./BeyondTheCheck";
import { CommonScams } from "./CommonScams";
import { RiskCard } from "./RiskCard";
import { ScreenshotInput, ScreenshotNote, ScreenshotTrigger } from "./ScreenshotInput";

/**
 * `screenshots` comes from the server (visionConfigured, the same check /api/health reports as "vision"), so the
 * upload control and its privacy note appear only when a vision model is configured. `example` (from ?example= on the
 * home page) pre-fills the box with a pattern's invented example; the check still waits for the Check button.
 */
/** Under the box: descriptions go through the same fixed patterns as messages. */
export const DESCRIBE_NOTE = "Works best with the actual message text; descriptions are checked with the same fixed patterns.";

export function CheckForm({ screenshots = false, example = null }: { screenshots?: boolean; example?: PatternExample | null }) {
  const [text, setText] = useState(example?.text ?? "");
  const [demo, setDemo] = useState(example !== null);
  const [fromExample, setFromExample] = useState(example !== null);
  // Which "Common scams in India" example is in the box (labelled as illustrative), if any.
  const [commonScam, setCommonScam] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [checkedText, setCheckedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // checkedAt of the one result that shows the "New: ..." line (first result in this browser session).
  const [newFor, setNewFor] = useState<string | null>(null);
  const newClaimed = useRef(false);

  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (result) document.getElementById("risk-card-title")?.focus();
  }, [result]);

  async function submit(input: string = text) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) {
        // Server errors are plain sentences (limits, rate limits) and never echo the input.
        const err = (await res.json().catch(() => null)) as { error?: string; issues?: string[] } | null;
        throw new Error(err?.issues?.[0] ?? err?.error ?? `Check failed (HTTP ${res.status})`);
      }
      const next = CheckResponse.parse(await res.json());
      if (!newClaimed.current) {
        newClaimed.current = true;
        if (claimNewLine()) setNewFor(next.checkedAt);
      }
      setResult(next);
      setCheckedText(input); // kept in the browser for the "I already paid" draft
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section aria-labelledby="input-label" className="print:hidden">
        <div className="grid">
          <div className="col-span-full flex flex-col lg:col-span-8">
            <form
              className="flex flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label id="input-label" htmlFor="input" className="eyebrow">
                Paste a message, or describe what happened
              </label>
              <textarea
                id="input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setDemo(false);
                  setFromExample(false);
                  setCommonScam(null);
                }}
                maxLength={MAX_INPUT_CHARS}
                rows={6}
                placeholder="Paste a message, or describe what happened"
                className="textarea mt-4"
              />
              {fromExample && example && (
                <p className="t-small mt-3 text-swiss-text" data-example={example.ruleId}>
                  Example from the pattern library: {example.name}. Edit it or press Check.
                </p>
              )}
              <p className="t-small mt-3 text-swiss-text">{DESCRIBE_NOTE}</p>
              {commonScam && (
                <p className="t-small mt-3 text-swiss-text" data-common-example={commonScam}>
                  {SCAM_TYPE_LABEL}. <a href="/about#scam-types" className="tap">Sources</a>
                </p>
              )}
              {demo && <p className="t-small mt-3 text-swiss-text">{SAMPLE_WATERMARK}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button type="submit" disabled={loading || text.trim().length === 0} className="button">
                  {loading ? "Checking..." : "Check"}
                </button>
                {screenshots && <ScreenshotTrigger />}
              </div>
              {error && (
                <p role="alert" className="mt-6">
                  <span className="font-semibold">Error. </span>
                  {error}
                </p>
              )}
              {loading && <p className="mt-6 text-swiss-text">Checking lists, on-chain history and reports. This can take up to 10 seconds.</p>}
            </form>
            {screenshots && (
              <ScreenshotInput
                disabled={loading}
                onCheck={(t) => {
                  setText(t);
                  setDemo(false);
                  setFromExample(false);
                  void submit(t);
                }}
              />
            )}
          </div>
          <aside className="col-span-full mt-12 flex flex-col border-t-2 border-swiss-black pt-6 lg:col-span-3 lg:col-start-10 lg:mt-0">
            <p className="eyebrow">Try a sample:</p>
            <ul className="mt-2 flex flex-col">
              {SAMPLES.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="btn-link text-left"
                    onClick={() => {
                      setText(s.text);
                      setDemo(true);
                      setFromExample(false);
                      setCommonScam(null);
                      setResult(null);
                    }}
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 border-t border-swiss-rule pt-6">
              <p className="t-small text-swiss-text">Processed in memory. We do not store your chat.</p>
              {screenshots ? <ScreenshotNote /> : <p className="t-small text-swiss-text">{SCREENSHOT_OFF}</p>}
            </div>
          </aside>
        </div>
      </section>
      {/* Under the form before a check; after the result once there is one, so it never pushes the answer down. */}
      {!result && (
        <CommonScams
          onPick={(id, t) => {
            setText(t);
            setDemo(true);
            setFromExample(false);
            setCommonScam(id);
            setResult(null);
            const box = document.getElementById("input");
            box?.scrollIntoView({ block: "center" });
            box?.focus();
          }}
        />
      )}
      {!result && <BeyondTheCheck />}
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? "Checking." : result ? `Result ready: ${result.risk.label}.` : ""}
      </p>
      <RiskCard result={result} demo={demo} text={checkedText} showNew={result !== null && result.checkedAt === newFor} />
      {result && <BeyondTheCheck />}
    </>
  );
}
