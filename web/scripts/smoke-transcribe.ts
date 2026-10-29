// One-off live check of screenshot reading against the real vision model. Prints sizes and
// timings only (never the image, and the transcript only when --show is passed, for your eyes).
// Run from web/: npx tsx scripts/smoke-transcribe.ts <path-to-screenshot.png|jpg|webp> [--show]
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { extractIdentifiers } from "../src/lib/identifiers";
import { MAX_IMAGE_DATAURL_CHARS } from "../src/lib/limits";
import { transcribeImage, TranscribeRequest, visionModel } from "../src/lib/transcribe";

const envFile = join(import.meta.dirname, "..", ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);
for (const k of ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_VISION_MODEL", "OPENAI_BASE_URL"]) {
  console.log(`${k}: ${process.env[k] ? "SET" : "MISSING"}`);
}

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function main() {
  const [path, flag] = process.argv.slice(2);
  if (!path) {
    console.error("usage: npx tsx scripts/smoke-transcribe.ts <screenshot> [--show]");
    process.exit(2);
  }
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) {
    console.error("FAIL: use a .png, .jpg/.jpeg or .webp file");
    process.exit(2);
  }
  const imageDataUrl = `data:${mime};base64,${readFileSync(path).toString("base64")}`;
  console.log(`image data URL: ${imageDataUrl.length} chars (limit ${MAX_IMAGE_DATAURL_CHARS}; the browser downscales first, this script does not)`);
  const req = TranscribeRequest.safeParse({ imageDataUrl });
  if (!req.success) {
    console.error(`FAIL: rejected by validation: ${req.error.issues[0].message}`);
    process.exit(1);
  }

  const t0 = Date.now();
  const r = await transcribeImage(req.data, { env: process.env });
  console.log(`model: ${visionModel(process.env) || "(none)"}  time: ${Date.now() - t0} ms`);
  if (!r.ok) {
    console.error(`FAIL: HTTP ${r.status}: ${r.error}`);
    process.exit(1);
  }
  console.log(`PASS: ${r.text.length} chars, ${r.text.split("\n").length} lines, truncated=${r.truncated}`);
  console.log(`identifiers our extractor finds in it: ${extractIdentifiers(r.text).map((i) => i.type).join(", ") || "none"}`);
  if (flag === "--show") console.log(`\n--- transcript ---\n${r.text}`);
}

void main();
