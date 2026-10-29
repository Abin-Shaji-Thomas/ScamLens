// Local Postgres (PGlite, in-memory WASM) loaded with db/schema.sql. Dev/test only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sqlDb, type Db } from "../lib/reports/db";

export const SCHEMA_PATH = join(import.meta.dirname, "..", "..", "db", "schema.sql");

export async function localDb(): Promise<{ db: Db; pg: PGlite }> {
  const pg = new PGlite();
  await pg.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return { db: sqlDb(pg), pg };
}
