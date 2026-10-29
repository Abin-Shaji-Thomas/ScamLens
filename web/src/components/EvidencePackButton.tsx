"use client";

import { useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { buildEvidencePack } from "@/lib/evidence-pack";

export function EvidencePackButton({ result, demo }: { result: CheckResponse; demo: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");
  const text = buildEvidencePack(result, { demo });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-neutral-900 px-3 py-1 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setState("copied");
            } catch {
              setState("shown"); // clipboard blocked: show the text so it can be copied by hand
            }
          }}
        >
          {state === "copied" ? "Copied" : "Copy evidence pack"}
        </button>
        <button type="button" className="text-xs underline" onClick={() => setState(state === "shown" ? "idle" : "shown")}>
          {state === "shown" ? "Hide" : "Preview"}
        </button>
      </div>
      {state === "shown" && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-neutral-200 p-2 text-[11px] dark:border-neutral-800">{text}</pre>
      )}
    </div>
  );
}
