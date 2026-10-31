// Exports the brand assets from whatever web/src/app/icon.svg contains, with the headless Edge or Chrome already used
// for screenshots (no new dependency):
//   docs/assets/logo.svg (copy), logo-512.png, logo-192.png, social-1200x630.png (the /opengraph-image of a running
//   production build) and web/src/app/apple-icon.png (180 px, picked up by Next.js by file name).
// Usage (from web/, with `next start` running): npx tsx scripts/export-brand-assets.ts [http://localhost:3000]
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const WEB = join(import.meta.dirname, "..");
const ROOT = join(WEB, "..");
const OUT = join(ROOT, "docs", "assets");
const ICON = join(WEB, "src", "app", "icon.svg");
const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((p): p is string => Boolean(p));

function browser(): string {
  const b = BROWSERS.find((p) => existsSync(p));
  if (!b) throw new Error("no Edge or Chrome found (set BROWSER_PATH)");
  return b;
}

/** Renders the icon centred on a square page of `size` px and saves a PNG screenshot. */
function renderIcon(size: number, out: string) {
  const dir = mkdtempSync(join(tmpdir(), "scamlens-brand-"));
  const page = join(dir, "icon.html");
  const svg = readFileSync(ICON, "utf8");
  writeFileSync(page, `<!doctype html><html><body style="margin:0;background:#fff"><div style="width:${size}px;height:${size}px">${svg.replace(/<svg /, `<svg style="width:${size}px;height:${size}px;display:block" `)}</div></body></html>`);
  execFileSync(browser(), ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${join(dir, "profile")}`, `--window-size=${size},${size}`, `--screenshot=${out}`, pathToFileURL(page).href], { stdio: "ignore" });
  if (!existsSync(out)) throw new Error(`screenshot not written: ${out}`);
}

async function main() {
  const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
  mkdirSync(OUT, { recursive: true });
  copyFileSync(ICON, join(OUT, "logo.svg"));
  renderIcon(512, join(OUT, "logo-512.png"));
  renderIcon(192, join(OUT, "logo-192.png"));
  renderIcon(180, join(WEB, "src", "app", "apple-icon.png"));
  const res = await fetch(`${base}/opengraph-image`);
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/png")) throw new Error(`/opengraph-image answered ${res.status} (is the production build running at ${base}?)`);
  writeFileSync(join(OUT, "social-1200x630.png"), Buffer.from(await res.arrayBuffer()));
  console.log("wrote docs/assets/logo.svg, logo-512.png, logo-192.png, social-1200x630.png and web/src/app/apple-icon.png");
}

main().catch((e: unknown) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
