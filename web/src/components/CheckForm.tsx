"use client";

import { useState } from "react";
import { CheckResponse, MAX_INPUT_CHARS } from "@/lib/api-schema";
import { SAMPLE_WATERMARK, SAMPLES } from "@/lib/samples";
import { RiskCard } from "./RiskCard";
import { ScreenshotInput } from "./ScreenshotInput";

export function CheckForm() {
  const [text, setText] = useState("");
  const [demo, setDemo] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="input" className="text-sm font-medium">
          Paste a suspicious chat, wallet address, UPI ID or Telegram handle
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500">Try a sample:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="rounded border border-neutral-300 px-2 py-0.5 dark:border-neutral-700"
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
        {demo && <p className="text-xs font-semibold uppercase text-fuchsia-700">{SAMPLE_WATERMARK}</p>}
        <textarea
          id="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDemo(false);
          }}
          maxLength={MAX_INPUT_CHARS}
          rows={8}
          className="w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm dark:border-neutral-700"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">Processed in memory. We do not store your chat.</p>
          <button
            type="submit"
            disabled={loading || text.trim().length === 0}
            className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {loading ? "Checking..." : "Check"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <ScreenshotInput
        disabled={loading}
        onCheck={(t) => {
          setText(t);
          setDemo(false);
          void submit(t);
        }}
      />
      <RiskCard result={result} demo={demo} />
    </div>
  );
}
