"use client";

import { useEffect, useRef, useState } from "react";
import { CheckResponse, MAX_INPUT_CHARS } from "@/lib/api-schema";
import { SAMPLE_WATERMARK, SAMPLES } from "@/lib/samples";
import { RiskCard } from "./RiskCard";
import { ScreenshotInput, ScreenshotTrigger } from "./ScreenshotInput";

export function CheckForm() {
  const [text, setText] = useState("");
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultBox = useRef<HTMLDivElement>(null);

  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (result) resultBox.current?.querySelector<HTMLElement>("#risk-card-title")?.focus();
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
    <div className="flex flex-col">
      <form
        className="flex flex-col print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="input" className="t-small text-swiss-text">
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
          className="field mt-2"
        />
        {demo && <p className="t-small mt-3 text-swiss-text">{SAMPLE_WATERMARK}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button type="submit" disabled={loading || text.trim().length === 0} className="btn-primary">
            {loading ? "Checking..." : "Check"}
          </button>
          <ScreenshotTrigger />
        </div>
        <p className="t-small mt-4 text-swiss-text">Processed in memory. We do not store your chat.</p>
        <div className="t-small mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-swiss-text">Try a sample:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="btn-link"
              onClick={() => {
                setText(s.text);
                setDemo(true);
                setResult(null);
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-6">
            <span className="font-semibold">Error. </span>
            {error}
          </p>
        )}
        {loading && <p className="mt-6 text-swiss-text">Checking lists, on-chain history and reports. This can take up to 10 seconds.</p>}
      </form>
      <div className="print:hidden">
        <ScreenshotInput
          disabled={loading}
          onCheck={(t) => {
            setText(t);
            setDemo(false);
            void submit(t);
          }}
        />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? "Checking." : result ? `Result ready: ${result.risk.label}.` : ""}
      </p>
      <div ref={resultBox} className="mt-16">
        <RiskCard result={result} demo={demo} />
      </div>
    </div>
  );
}
