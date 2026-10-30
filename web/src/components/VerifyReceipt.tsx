"use client";

import Link from "next/link";
import { useState } from "react";
import { INVALID_MESSAGE, RECEIPT_KEY_PATH, Receipt, ReceiptKey, signedBytes, validMessage } from "@/lib/receipt-format";
import { EXAMPLE_COST_NOTE, fetchExampleReceipt } from "@/lib/verify-example";

type Outcome = { ok: boolean; message: string; how: string; textNote?: string };

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

/** Verifies in the browser with WebCrypto Ed25519; returns null when the browser cannot (then the server is asked). */
async function verifyInBrowser(r: Receipt): Promise<boolean | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const res = await fetch(RECEIPT_KEY_PATH);
    if (!res.ok) return null;
    const k = ReceiptKey.parse(await res.json());
    if (k.keyId !== r.keyId) return false;
    const key = await crypto.subtle.importKey("raw", fromB64url(k.publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromB64url(r.signature), signedBytes(r) as BufferSource);
  } catch {
    return null;
  }
}

export function VerifyReceipt() {
  const [json, setJson] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);
  const [example, setExample] = useState<"idle" | "loading" | "filled">("idle");
  const [exampleError, setExampleError] = useState<string | null>(null);

  async function tryExample() {
    setExample("loading");
    setExampleError(null);
    const got = await fetchExampleReceipt();
    if ("json" in got) {
      setJson(got.json);
      setOut(null);
      setExample("filled");
    } else {
      setExampleError(got.error);
      setExample("idle");
    }
  }

  async function run() {
    setBusy(true);
    setOut(null);
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(json);
      } catch {
        setOut({ ok: false, message: "That is not valid JSON. Paste the whole receipt file.", how: "" });
        return;
      }
      const parsed = Receipt.safeParse(raw);
      if (!parsed.success) {
        setOut({ ok: false, message: INVALID_MESSAGE, how: "The file does not have the shape of a ScamLens receipt." });
        return;
      }
      const local = text.trim() ? null : await verifyInBrowser(parsed.data);
      if (local !== null) {
        setOut({ ok: local, message: local ? validMessage(parsed.data.issuedAt) : INVALID_MESSAGE, how: "Checked in your browser with the published key." });
        return;
      }
      const res = await fetch("/api/verify-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text.trim() ? { receipt: raw, text } : { receipt: raw }),
      });
      const body = (await res.json().catch(() => null)) as { valid?: boolean; issuedAt?: string; textMatches?: boolean; error?: string } | null;
      if (!res.ok || !body || typeof body.valid !== "boolean") {
        setOut({ ok: false, message: body?.error ?? `The receipt could not be checked (HTTP ${res.status}).`, how: "" });
        return;
      }
      setOut({
        ok: body.valid,
        message: body.valid ? validMessage(body.issuedAt ?? parsed.data.issuedAt) : INVALID_MESSAGE,
        how: "Checked by the ScamLens server.",
        textNote:
          body.textMatches === undefined
            ? undefined
            : body.textMatches
              ? "The text you pasted is the text that was checked."
              : "The text you pasted is not the text that was checked (or it was changed).",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <label htmlFor="receipt-json" className="eyebrow">
        Paste the receipt (the downloaded JSON file)
      </label>
      <textarea
        id="receipt-json"
        className="textarea mt-4"
        value={json}
        onChange={(e) => {
          setJson(e.target.value);
          setExample("idle");
        }}
        rows={8}
      />
      {example === "filled" && <p className="t-small mt-3 text-swiss-text">Example receipt for sample 3 filled in. Press Verify to check it.</p>}
      {!json.trim() && example !== "filled" && (
        <div className="card mt-6 flex flex-col" data-verify-empty>
          <h2 className="font-semibold text-swiss-black">How to get a receipt</h2>
          <p className="mt-2 text-swiss-text">
            Run a check on the <Link href="/" className="tap">home page</Link>, then press &ldquo;Download signed receipt&rdquo; under Share proof.
            Open the downloaded file and paste everything in it here.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="button" className="button button--outline" disabled={example === "loading"} onClick={() => void tryExample()}>
              {example === "loading" ? "Getting an example..." : "Try an example"}
            </button>
          </div>
          <p className="t-small mt-3 text-swiss-text">{EXAMPLE_COST_NOTE}</p>
          {exampleError && (
            <p role="alert" className="mt-3 text-swiss-black">
              {exampleError}
            </p>
          )}
        </div>
      )}
      <label htmlFor="receipt-text" className="eyebrow mt-8">
        Optional: the original text, to confirm it matches
      </label>
      <textarea id="receipt-text" className="textarea mt-4" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <p className="t-small mt-3 text-swiss-text">
        If you paste the text, it is sent to the ScamLens server once to compare its digest, and it is not stored.
      </p>
      <div className="mt-8">
        <button type="button" className="button" disabled={busy || !json.trim()} onClick={() => void run()}>
          {busy ? "Checking..." : "Verify"}
        </button>
      </div>
      <div role="status" aria-live="polite" className="mt-8">
        {out && (
          <div className="card flex flex-col">
            <p className="font-semibold text-swiss-black">{out.message}</p>
            {out.textNote && <p className="mt-2 text-swiss-black">{out.textNote}</p>}
            {out.how && <p className="t-small mt-2 text-swiss-text">{out.how}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
