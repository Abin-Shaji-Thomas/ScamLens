import { CheckResponse } from "./api-schema";
import { SAMPLES } from "./samples";

/** The sample the /verify "Try an example" button checks (sample 3: the fake bank alert). */
export const EXAMPLE_SAMPLE = SAMPLES[2];
export const EXAMPLE_COST_NOTE = "This runs a real check on sample 3 and uses 1 of today's checks.";
export const NO_RECEIPTS_MESSAGE = "This server is not signing receipts right now, so there is no example to verify.";

/**
 * Runs sample 3 through /api/check and returns its signed receipt as the pretty JSON a downloaded file holds. It only
 * fills the box; verifying stays a separate press of Verify.
 */
export async function fetchExampleReceipt(fetchFn: typeof fetch = fetch): Promise<{ json: string } | { error: string }> {
  try {
    const res = await fetchFn("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: EXAMPLE_SAMPLE.text }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      return { error: err?.error ?? `The example check failed (HTTP ${res.status}).` };
    }
    const parsed = CheckResponse.safeParse(await res.json());
    if (!parsed.success) return { error: "The example check returned an unexpected answer." };
    if (!parsed.data.receipt) return { error: NO_RECEIPTS_MESSAGE };
    return { json: JSON.stringify(parsed.data.receipt, null, 2) };
  } catch {
    return { error: "The example check could not reach the server." };
  }
}
