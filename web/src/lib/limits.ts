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
