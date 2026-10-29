import { z } from "zod";
import { tgConfig } from "./graph";
import { MIN_PEPPER_LENGTH } from "./reports/privacy";
import { visionConfigured } from "./transcribe";
import { llmConfigured } from "./usage";

// Health reports only booleans and short fixed statuses. It never echoes an env value and makes no network
// calls, so it is safe to expose and cheap to poll (also used to warm the function before a demo).
export const HealthResponse = z.object({
  ok: z.literal(true),
  db: z.enum(["configured", "not configured"]),
  reports: z.enum(["configured", "not configured"]),
  graph: z.enum(["tigergraph", "postgres", "none"]),
  usageStore: z.enum(["supabase", "memory"]),
  llm: z.boolean(),
  vision: z.boolean(),
  etherscan: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export function getHealth(env: Record<string, string | undefined> = process.env): HealthResponse {
  const db = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  return HealthResponse.parse({
    ok: true,
    db: db ? "configured" : "not configured",
    reports: db && (env.REPORT_HASH_PEPPER ?? "").length >= MIN_PEPPER_LENGTH ? "configured" : "not configured",
    graph: tgConfig(env) ? "tigergraph" : db ? "postgres" : "none",
    usageStore: db ? "supabase" : "memory",
    llm: llmConfigured(env),
    vision: visionConfigured(env),
    etherscan: Boolean(env.ETHERSCAN_API_KEY),
  });
}
