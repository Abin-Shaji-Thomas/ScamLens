// One-time "New: ..." line on the first result in a browser session, so returning visitors notice the newer parts.

export const NEW_LINE_KEY = "scamlens:new-line-seen";

/** Names only what this result actually has: the receipt appears only when the server signed one. */
export function newLineText(hasReceipt: boolean): string {
  return hasReceipt
    ? "New: signed receipt, what was checked, and an 'I already paid' plan are below."
    : "New: what was checked, and an 'I already paid' plan are below.";
}

/**
 * True the first time it is called in a browser session (and records that in sessionStorage). Blocked or missing
 * storage (private windows, strict settings) returns true; the caller still shows the line at most once per page.
 */
export function claimNewLine(storage: () => Storage | undefined = () => globalThis.sessionStorage): boolean {
  try {
    const s = storage();
    if (!s) return true;
    if (s.getItem(NEW_LINE_KEY)) return false;
    s.setItem(NEW_LINE_KEY, "1");
    return true;
  } catch {
    return true;
  }
}
