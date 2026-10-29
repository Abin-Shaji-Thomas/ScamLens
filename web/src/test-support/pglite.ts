// Local Postgres (PGlite, in-memory WASM) loaded with db/schema.sql and db/migrations/*.sql. Dev/test only.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sqlDb, type Db } from "../lib/reports/db";

export const SCHEMA_PATH = join(import.meta.dirname, "..", "..", "db", "schema.sql");
export const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "db", "migrations");

/** `migrations: false` gives the pre-migration schema, to test that the code still works against it. */
export async function localDb({ migrations = true }: { migrations?: boolean } = {}): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite();
  await pg.exec(readFileSync(SCHEMA_PATH, "utf8"));
  if (migrations) {
    for (const f of readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql")).sort()) {
      await pg.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    }
  }
  return { db: sqlDb(pg), pg };
}
