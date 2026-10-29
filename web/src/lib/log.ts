// Safe logger: event name, status and duration only. It can never carry user content.
export const FORBIDDEN_LOG_FIELDS = ["text", "quote", "transcript", "identifier", "value", "image", "body", "input"] as const;

export interface LogFields {
  status?: string | number;
  durationMs?: number;
}

const EVENT = /^[a-z0-9_.:-]{1,64}$/;
const STATUS = /^[A-Za-z0-9_.:-]{0,40}$/;

/** Throws on any field other than status/durationMs, so a stray `text: userInput` fails loudly in tests. */
export function formatLog(event: string, fields: LogFields & Record<string, unknown> = {}): string {
  if (!EVENT.test(event)) throw new Error("log: invalid event name");
  for (const k of Object.keys(fields)) {
    if (k !== "status" && k !== "durationMs") throw new Error(`log: field "${k}" is not allowed`);
  }
  const status = fields.status === undefined ? undefined : String(fields.status);
  if (status !== undefined && !STATUS.test(status)) throw new Error("log: invalid status");
  if (fields.durationMs !== undefined && (typeof fields.durationMs !== "number" || !Number.isFinite(fields.durationMs))) {
    throw new Error("log: invalid durationMs");
  }
  return JSON.stringify({ event, status, durationMs: fields.durationMs === undefined ? undefined : Math.round(fields.durationMs) });
}

export function logEvent(event: string, fields: LogFields = {}): void {
  try {
    console.info(formatLog(event, fields as LogFields & Record<string, unknown>));
  } catch {
    console.info(JSON.stringify({ event: "log_rejected" }));
  }
}
