"use client";

import { useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { receiptCode } from "@/lib/receipt-format";

export function EvidencePackButton({ result, demo }: { result: CheckResponse; demo: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "shown">("idle");
  const text = buildEvidencePack(result, { demo });
  return (
    <div className="flex flex-col">
      <h2 className="t-h2 print:hidden">Evidence pack</h2>
      <p className="mt-2 text-swiss-text print:hidden">A plain-text summary to keep, send to your bank, or attach to a complaint.</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 print:hidden">
        <button
          type="button"
          className="button"
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
        {result.receipt && (
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              // Built in the browser from the response; the receipt holds no raw text.
              const blob = new Blob([JSON.stringify(result.receipt, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `scamlens-receipt-${receiptCode(result.receipt!)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          >
            Download signed receipt
          </button>
        )}
      </div>
      {result.receipt && (
        <p className="t-small mt-3 text-swiss-text print:hidden">
          Receipt code {receiptCode(result.receipt)}. Anyone can check the receipt file at{" "}
          <a href="/verify" className="tap">
            /verify
          </a>
          .
        </p>
      )}
      {state === "shown" && (
        <pre className="t-small mt-6 max-h-96 overflow-auto whitespace-pre-wrap font-sans print:mt-0 print:max-h-none print:overflow-visible">{text}</pre>
      )}
    </div>
  );
}
