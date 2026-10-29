"use client";

import { useEffect, useState } from "react";
import { CheckResponse, MAX_INPUT_CHARS } from "@/lib/api-schema";
import { SAMPLE_WATERMARK, SAMPLES } from "@/lib/samples";
import { SCREENSHOT_OFF } from "@/lib/screenshot-copy";
import { RiskCard } from "./RiskCard";
import { ScreenshotInput, ScreenshotNote, ScreenshotTrigger } from "./ScreenshotInput";

/**
 * `screenshots` comes from the server (visionConfigured, the same check /api/health reports as "vision"), so the
 * upload control and its privacy note appear only when a vision model is configured.
 */
export function CheckForm({ screenshots = false }: { screenshots?: boolean }) {
  const [text, setText] = useState("");
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setResult(CheckResponse.parse(await res.json()));
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
                Paste a suspicious chat, wallet address, UPI ID or Telegram handle
              </label>
              <textarea
                id="input"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setDemo(false);
                }}
                maxLength={MAX_INPUT_CHARS}
                rows={6}
                placeholder="Paste the message here"
                className="textarea mt-4"
              />
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
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? "Checking." : result ? `Result ready: ${result.risk.label}.` : ""}
      </p>
      <RiskCard result={result} demo={demo} />
    </>
  );
}
