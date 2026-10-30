// Hard input limits. Every route enforces these before doing any work.
export const MAX_TEXT_CHARS = 6000;
export const MAX_IMAGE_DATAURL_CHARS = 1_500_000;
export const MAX_IDENTIFIERS = 20;
export const MAX_GRAPH_LOOKUPS = 10;

/** Raw request bodies above this are rejected with 413 before JSON parsing (JSON overhead included). */
export const MAX_JSON_BODY_CHARS = MAX_TEXT_CHARS * 2 + 1000;
export const MAX_IMAGE_BODY_CHARS = MAX_IMAGE_DATAURL_CHARS + 1000;

// Report rules (mirrored in db/schema.sql; a test checks the SQL uses the same numbers).
export const MIN_INDEPENDENT_REPORTERS = 2;
export const REPORT_RETENTION_DAYS = 90;
export const DEFAULT_REPORTS_MAX_PER_DAY = 5;
/** Daily usage counters (db/schema.sql increment_usage) are pruned after this many days. */
export const USAGE_COUNTER_RETENTION_DAYS = 7;
/** Contest reasons are deleted by purge_old_contests() (db/migrations/003) once decided or older than this. */
export const CONTEST_RETENTION_DAYS = 90;
