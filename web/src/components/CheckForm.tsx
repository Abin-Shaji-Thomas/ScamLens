"use client";

import { useState } from "react";
import { CheckResponse, MAX_INPUT_CHARS } from "@/lib/api-schema";
import { RiskCard } from "./RiskCard";

export function CheckForm() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Check failed (HTTP ${res.status})`);
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
          Paste a suspicious chat, screenshot text, wallet address, UPI ID or Telegram handle
        </label>
        <textarea
          id="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
      <RiskCard result={result} />
    </div>
  );
}
