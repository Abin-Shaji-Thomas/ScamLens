// Security headers applied to every route via next.config.ts headers().
// CSP follows the Next.js 16 "Without Nonces" guide (node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md) so pages stay statically renderable. All API calls are same-origin.
export function contentSecurityPolicy(isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // No upgrade-insecure-requests: Vercel already serves HTTPS, and it breaks `npm run start` on http://localhost.
  ].join("; ");
}

export function securityHeaders(isDev: boolean): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ];
}

/** "a b; c d" -> { a: ["b"], c: ["d"] }. Used by the header test and scripts/check-headers.ts. */
export function parseCsp(header: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of header.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name.toLowerCase()] = values;
  }
  return out;
}

/**
 * The directives the app must ship with. Next.js 16 puts its page data and bundler bootstrap in inline
 * <script> tags (checked in the build output: `self.__next_f.push(...)` and `<script id="_R_">`), so
 * 'unsafe-inline' is required for scripts; no remote origin is allowed anywhere.
 */
export const REQUIRED_CSP: Record<string, string[]> = {
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

export const REQUIRED_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

/** One PASS/FAIL line per expectation for a CSP header value (production rules: no unsafe-eval). */
export function checkCsp(header: string | null): { name: string; ok: boolean; detail: string }[] {
  if (!header) return [{ name: "content-security-policy present", ok: false, detail: "missing" }];
  const csp = parseCsp(header);
  const sameSet = (a: string[] = [], b: string[]) => a.length === b.length && b.every((v) => a.includes(v));
  return [
    ...Object.entries(REQUIRED_CSP).map(([d, want]) => ({
      name: `csp ${d}`,
      ok: sameSet(csp[d], want),
      detail: (csp[d] ?? ["(missing)"]).join(" "),
    })),
    { name: "csp has no unsafe-eval", ok: !header.includes("unsafe-eval"), detail: header.includes("unsafe-eval") ? "present" : "absent" },
    { name: "csp allows no remote origin", ok: !/https?:\/\//.test(header), detail: /https?:\/\//.test(header) ? "remote origin found" : "none" },
  ];
}
