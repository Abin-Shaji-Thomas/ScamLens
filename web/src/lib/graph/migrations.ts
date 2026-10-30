// TigerGraph migrations, decided without side effects (used by scripts/tg-setup.ts, tested in migrations.test.ts).
// The graph-scoped token cannot make GLOBAL schema changes ("Access Denied ... attempting operations on global"),
// so a missing attribute is never sent from here: tg-setup stops and prints the GSQL for the owner to run in the
// Savanna GSQL editor.

export interface GraphMigration {
  id: string;
  file: string;
  vertex: string;
  attribute: string;
}

export const MIGRATIONS: readonly GraphMigration[] = [
  { id: "001", file: "001_report_reporter_key.gsql", vertex: "Report", attribute: "reporter_key" },
];

interface SchemaAttr {
  AttributeName?: string;
}
interface SchemaVertex {
  Name?: string;
  Attributes?: SchemaAttr[];
}

/** True when the schema response (GET /gsql/v1/schema/graphs/<graph>) has `vertex.attribute`. */
export function hasVertexAttribute(schema: unknown, vertex: string, attribute: string): boolean {
  const root = (schema ?? {}) as { results?: { VertexTypes?: SchemaVertex[] }; VertexTypes?: SchemaVertex[] };
  const types = root.results?.VertexTypes ?? root.VertexTypes ?? [];
  const v = types.find((t) => t.Name === vertex);
  return Boolean(v?.Attributes?.some((a) => a.AttributeName === attribute));
}

export type MigrationDecision =
  | { action: "skip"; message: string }
  | { action: "human"; message: string; exitCode: 2 };

/** Skip an applied migration; otherwise a human step with the exact GSQL (never a global call with the graph token). */
export function decideMigration(m: GraphMigration, schema: unknown, gsqlText: string): MigrationDecision {
  if (hasVertexAttribute(schema, m.vertex, m.attribute)) {
    return { action: "skip", message: `migration ${m.id} already applied (${m.vertex}.${m.attribute} exists)` };
  }
  return {
    action: "human",
    exitCode: 2,
    message: [
      `HUMAN STEP REQUIRED: migration ${m.id} (${m.vertex}.${m.attribute}) is missing.`,
      "It is a GLOBAL schema change, which the graph-scoped token is not allowed to make.",
      "Open TigerGraph Savanna -> the ScamLens workspace -> GSQL editor, paste and run exactly this:",
      "",
      gsqlText.trim(),
      "",
      "Then re-run: cd web && npx tsx scripts/tg-setup.ts",
    ].join("\n"),
  };
}

/** Masks every secret (the database secret and any bearer token) and caps the text at 800 characters. */
export function maskDetail(detail: string, secrets: (string | undefined)[]): string {
  let out = detail;
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join("***");
  out = out.replace(/(Bearer|GSQL-Secret)\s+[A-Za-z0-9._~+/=-]{6,}/g, "$1 ***");
  return out.length > 800 ? `${out.slice(0, 800)}...` : out;
}
