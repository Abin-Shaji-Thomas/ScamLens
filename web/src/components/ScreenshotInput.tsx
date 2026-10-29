"use client";

import { useId, useState } from "react";
import { MAX_IMAGE_DATAURL_CHARS, MAX_TEXT_CHARS } from "@/lib/limits";

const MAX_SIDE = 1600;

/** Downscales to <= 1600 px on the longest side and re-encodes as JPEG (drops EXIF and other metadata). */
async function toJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot read images. Please paste the text instead.");
  ctx.fillStyle = "#ffffff"; // transparent PNG areas would turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const q of [0.8, 0.6, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= MAX_IMAGE_DATAURL_CHARS) return url;
  }
  throw new Error("That image is too large. Please crop the screenshot and try again.");
}

const FILE_INPUT_ID = "screenshot-file";

/** The plain text link next to Check. It opens the file picker owned by ScreenshotInput. */
export function ScreenshotTrigger() {
  return (
    <button type="button" className="btn-link" onClick={() => document.getElementById(FILE_INPUT_ID)?.click()}>
      Upload a screenshot instead
    </button>
  );
}

/** Screenshot -> editable transcript. Only the text the user confirms is checked. */
export function ScreenshotInput({ onCheck, disabled }: { onCheck: (text: string) => void; disabled: boolean }) {
  const textId = useId();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  async function read(file: File) {
    setReading(true);
    setError(null);
    setTranscript(null);
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Please choose a PNG, JPEG or WebP screenshot.");
      const imageDataUrl = await toJpegDataUrl(file);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; text?: string; truncated?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok || typeof body.text !== "string") throw new Error(body?.error ?? `Could not read the screenshot (HTTP ${res.status}).`);
      setTranscript(body.text);
      setTruncated(Boolean(body.truncated));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the screenshot. Please paste the text instead.");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose a screenshot (PNG, JPEG or WebP)"
        className="hidden"
        disabled={reading || disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void read(f);
        }}
      />
      <div aria-live="polite">
        {reading && <p className="mt-6 text-swiss-text">Reading the screenshot...</p>}
        {error && (
          <p className="mt-6">
            <span className="font-semibold">Error. </span>
            {error}
          </p>
        )}
      </div>
      {transcript !== null && (
        <div className="mt-12 flex flex-col">
          <label htmlFor={textId} className="t-small text-swiss-text">
            Text read from your screenshot. Edit if needed, then check.
          </label>
          <textarea
            id={textId}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            maxLength={MAX_TEXT_CHARS}
            rows={6}
            className="field mt-2"
          />
          {truncated && <p className="t-small mt-3 text-swiss-text">Only the first {MAX_TEXT_CHARS.toLocaleString("en-IN")} characters were kept.</p>}
          <div className="mt-6">
            <button type="button" disabled={disabled || transcript.trim().length === 0} onClick={() => onCheck(transcript)} className="btn-primary">
              Check this text
            </button>
          </div>
        </div>
      )}
      <p className="t-small mt-4 text-swiss-text">
        Screenshots are shrunk in your browser, sent once to our AI provider to read the text, and not stored.
      </p>
    </div>
  );
}
