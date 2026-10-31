// Shape of GET /api/usage-stats (client-safe; the server side is usage-stats.ts). One total only: no keys, no hashes.
import { z } from "zod";

export const USAGE_STATS_DAYS = 7;

export const UsageStats = z.object({
  checks: z.number().int().nonnegative(),
  days: z.literal(USAGE_STATS_DAYS),
});
export type UsageStats = z.infer<typeof UsageStats>;

export function usageStatsSentence(s: UsageStats): string {
  return `Checks run in the last ${s.days} days: ${s.checks.toLocaleString("en-IN")} (includes our own testing). ScamLens does not track who runs them.`;
}
