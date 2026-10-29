import { createClient } from "@supabase/supabase-js";

/** Tables the graph sync may read in full (never the reports table: it holds reporter fingerprints). */
export const EXPORTABLE = {
  graph_edges: "src_hash,src_type,src_display,dst_hash,dst_type,dst_display,relation,evidence,submission_id,synthetic,expires_at,reporter_key",
  flagged_addresses: "address_hash,display,source,synthetic",
  exchange_addresses: "address_hash,label,synthetic",
} as const;
export type ExportTable = keyof typeof EXPORTABLE;

/** Calls a set-returning SQL function from db/schema.sql and returns its rows. */
export interface Db {
  call<T>(fn: string, args: Record<string, unknown>): Promise<T[]>;
  selectAll<T>(table: ExportTable): Promise<T[]>;
}

/** Anything with a node-postgres-style query(), e.g. PGlite. Used for local runs and tests. */
export interface SqlRunner {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export function sqlDb(runner: SqlRunner): Db {
  return {
    async call<T>(fn: string, args: Record<string, unknown>) {
      if (!/^[a-z0-9_]+$/.test(fn)) throw new Error("bad function name");
      const names = Object.keys(args);
      for (const n of names) if (!/^p_[a-z0-9_]+$/.test(n)) throw new Error("bad arg name");
      const sql = `select * from ${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")})`;
      const params = names.map((n) => {
        const v = args[n];
        return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
      });
      return (await runner.query<T>(sql, params)).rows;
    },
    async selectAll<T>(table: ExportTable) {
      return (await runner.query<T>(`select ${EXPORTABLE[table]} from ${table}`)).rows;
    },
  };
}

const PAGE = 1000;

export function supabaseDb(url: string, serviceRoleKey: string): Db {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async call<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await client.rpc(fn, args);
      // Do not surface PostgREST error details to users.
      if (error) throw new Error(`database call ${fn} failed`);
      return (data ?? []) as T[];
    },
    async selectAll<T>(table: ExportTable) {
      const out: T[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client.from(table).select(EXPORTABLE[table]).range(from, from + PAGE - 1);
        if (error) throw new Error(`database read ${table} failed`);
        out.push(...((data ?? []) as T[]));
        if (!data || data.length < PAGE) return out;
      }
    },
  };
}

/** The production database, or null when Supabase is not configured. */
export function dbFromEnv(env: Record<string, string | undefined>): Db | null {
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? supabaseDb(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;
}
