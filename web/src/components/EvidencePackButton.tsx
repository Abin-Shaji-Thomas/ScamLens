"use client";

import { useState } from "react";
import type { CheckResponse } from "@/lib/api-schema";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { receiptCode, type Receipt } from "@/lib/receipt-format";

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
      </div>
      {state === "shown" && (
        <pre className="t-small mt-6 max-h-96 overflow-auto whitespace-pre-wrap font-sans print:mt-0 print:max-h-none print:overflow-visible">{text}</pre>
      )}
      {result.receipt && <ShareProof receipt={result.receipt} />}
    </div>
  );
}

/** "Share proof": the signed receipt as a labelled step. Only shown when the check returned a receipt. */
export function ShareProof({ receipt }: { receipt: Receipt }) {
  return (
    <div className="mt-10 flex flex-col border-t-2 border-swiss-black pt-6 print:hidden" data-share-proof>
      <h3 className="t-h2">Share proof</h3>
      <p className="mt-2 text-swiss-text">
        Download the signed receipt and send it to your bank, a family member or the cybercrime portal. Anyone can check at Verify that it
        was not edited.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          className="button button--outline"
          onClick={() => {
            // Built in the browser from the response; the receipt holds no raw text.
            const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `scamlens-receipt-${receiptCode(receipt)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}
        >
          Download signed receipt
        </button>
        <a href="/verify" className="inline-flex min-h-11 items-center">
          Open Verify
        </a>
      </div>
      <p className="t-small mt-3 text-swiss-text">Receipt code {receiptCode(receipt)}.</p>
    </div>
  );
}
