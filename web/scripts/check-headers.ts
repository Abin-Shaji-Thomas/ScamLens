// Checks the security headers a running server actually sends. Prints PASS/FAIL per header and exits 1 on any FAIL.
// Run from web/: npx tsx scripts/check-headers.ts http://localhost:3000   (or the live URL)
import { checkCsp, REQUIRED_HEADERS } from "../src/lib/security-headers";

const PATHS = ["/", "/about", "/api/health"];

async function main() {
  const base = (process.argv[2] ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) {
    console.error("usage: npx tsx scripts/check-headers.ts <base-url>");
    process.exit(2);
  }
  let failed = 0;
  let total = 0;
  const line = (path: string, name: string, ok: boolean, detail: string) => {
    total++;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  [${path}] ${name}${detail ? ` (${detail})` : ""}`);
  };
  for (const path of PATHS) {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    } catch (e) {
      line(path, "reachable", false, e instanceof Error ? e.name : "error");
      continue;
    }
    line(path, "HTTP status", res.status === 200, String(res.status));
    for (const c of checkCsp(res.headers.get("content-security-policy"))) line(path, c.name, c.ok, c.detail);
    for (const [name, want] of Object.entries(REQUIRED_HEADERS)) {
      const got = res.headers.get(name);
      line(path, name, got === want, got ?? "missing");
    }
    const pp = res.headers.get("permissions-policy");
    line(path, "permissions-policy", Boolean(pp && /camera=\(\)/.test(pp) && /microphone=\(\)/.test(pp)), pp ?? "missing");
  }
  console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAIL`} (${total} checks)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
