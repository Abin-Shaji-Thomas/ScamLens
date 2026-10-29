import { CheckResponse, type CheckRequest } from "./api-schema";
import { extractIdentifiers } from "./identifiers";
import { runVerifiedChecks } from "./verified";
import { defaultDeps, type CheckDeps } from "./verified/types";

export { CheckRequest, CheckResponse, MAX_INPUT_CHARS } from "./api-schema";

/** Runs every check on `text` in memory. Nothing here stores or logs the input. */
export async function runCheck({ text }: CheckRequest, deps: CheckDeps = defaultDeps()): Promise<CheckResponse> {
  const identifiers = extractIdentifiers(text);
  const verified = await runVerifiedChecks(identifiers, deps);
  return CheckResponse.parse({ identifiers, verified, reported: [], suspected: [], checkedAt: deps.now().toISOString() });
}
