"use client";

import { useState } from "react";
import { RiskCard } from "./RiskCard";

export const MAX_INPUT_CHARS = 20000;

export function CheckForm() {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setChecked(true);
        }}
      >
        <label htmlFor="input" className="text-sm font-medium">
          Paste a suspicious chat, screenshot text, wallet address, UPI ID or Telegram handle
        </label>
        <textarea
          id="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setChecked(false);
          }}
          maxLength={MAX_INPUT_CHARS}
          rows={8}
          className="w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm dark:border-neutral-700"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">Processed in memory. We do not store your chat.</p>
          <button
            type="submit"
            disabled={text.trim().length === 0}
            className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Check
          </button>
        </div>
      </form>
      <RiskCard checked={checked} />
    </div>
  );
}
