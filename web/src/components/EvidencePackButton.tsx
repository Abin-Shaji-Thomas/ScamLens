"use client";

import { useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { buildEvidencePack } from "@/lib/evidence-pack";

export function EvidencePackButton({ result, demo }: { result: CheckResponse; demo: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");
  const text = buildEvidencePack(result, { demo });
  return (
    <div className="flex flex-col">
      <h3 className="t-h2 print:hidden">Evidence pack</h3>
      <p className="t-small mt-1 text-muted print:hidden">A plain-text summary to keep, send to your bank, or attach to a complaint.</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden">
        <button
          type="button"
          className="btn-primary"
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
        <button type="button" className="btn-link" aria-expanded={state === "shown"} onClick={() => setState(state === "shown" ? "idle" : "shown")}>
          {state === "shown" ? "Hide" : "Preview"}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setState("shown");
            // Let React render the preview before the print dialog opens.
            setTimeout(() => window.print(), 50);
          }}
        >
          Print or save as PDF
        </button>
      </div>
      {state === "shown" && (
        <pre className="t-small mt-6 max-h-96 overflow-auto whitespace-pre-wrap font-sans print:mt-0 print:max-h-none print:overflow-visible">{text}</pre>
      )}
    </div>
  );
}
