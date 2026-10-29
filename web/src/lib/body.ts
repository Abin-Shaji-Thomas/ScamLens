import type { z } from "zod";
import { MAX_JSON_BODY_CHARS, MAX_TEXT_CHARS } from "./limits";

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Reads a JSON body with a size cap (413) and validates it with zod (400).
 * Error responses never echo the submitted content.
 */
export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxChars = MAX_JSON_BODY_CHARS,
  tooLargeMessage = `That is too long. Please paste at most ${MAX_TEXT_CHARS.toLocaleString("en-IN")} characters.`,
): Promise<BodyResult<T>> {
  const tooLarge = () => Response.json({ ok: false, error: tooLargeMessage }, { status: 413 });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxChars * 4) return { ok: false, response: tooLarge() };
  const raw = await request.text();
  if (raw.length > maxChars) return { ok: false, response: tooLarge() };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, response: Response.json({ ok: false, error: "The request body must be JSON." }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: Response.json({ ok: false, error: "Invalid input", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}
