// Shape of GET /api/graph/stats (client-safe; the server side is stats.ts). Counts only: no ids, no labels.
import { z } from "zod";

export const GraphStats = z.object({
  backend: z.enum(["tigergraph", "postgres"]),
  vertices: z.number().int().nonnegative(),
  edges: z.number().int().nonnegative(),
  asOf: z.string(),
});
export type GraphStats = z.infer<typeof GraphStats>;
