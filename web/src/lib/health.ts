import { z } from "zod";

export const HealthResponse = z.object({ ok: z.literal(true) });
export type HealthResponse = z.infer<typeof HealthResponse>;

export function getHealth(): HealthResponse {
  return HealthResponse.parse({ ok: true });
}
