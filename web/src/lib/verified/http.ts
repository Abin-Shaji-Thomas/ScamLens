import type { CheckDeps } from "./types";

/** Thrown when a source cannot give an answer. The message is shown to users, so it never contains URLs or keys. */
export class Unavailable extends Error {}

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

export async function getJson(deps: CheckDeps, url: string, headers: Record<string, string> = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await deps.fetch(url, { headers, signal: AbortSignal.timeout(deps.timeoutMs), cache: "no-store" });
  } catch (e) {
    throw new Unavailable(isAbort(e) ? "timed out" : "network error");
  }
  if (!res.ok) throw new Unavailable(`HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Unavailable("invalid response");
  }
}

/** Outer guard: rejects with Unavailable("timed out") if `p` takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Unavailable("timed out")), ms);
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(timer));
}

export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
