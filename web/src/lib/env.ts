/** Positive integer from an env var; empty, missing or invalid values fall back to `fallback`. */
export function positiveIntEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value?.trim() && Number.isFinite(n) && n > 0 ? n : fallback;
}
