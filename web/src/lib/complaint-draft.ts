// "I already paid": the ordered plan and a complaint draft built entirely in the browser.
// Nothing here talks to a server: the fields live in browser memory and the draft goes to the clipboard.
import { extractIdentifiers, uniqueIdentifiers } from "./identifiers";

/** The ordered plan. No promise of recovery; time matters most for steps 1 and 2. */
export const PAID_PLAN: readonly string[] = [
  "Call 1930 (the National Cyber Crime Helpline) now. Time matters: the sooner it is reported, the better the chance a payment can be held.",
  "Tell your bank or UPI app immediately and ask them to hold or reverse the payment. Note the complaint number they give you.",
  "File a complaint at cybercrime.gov.in.",
  "Keep the chat, screenshots, transaction IDs, wallet addresses and phone numbers. Do not delete anything.",
  "If you sent crypto, note the transaction hash and the destination address. An exchange that holds that address may be able to act; nothing is guaranteed.",
  'Do not pay any "recovery fee" or "tax to withdraw". These match patterns ScamLens flags.',
  "Tell someone you trust, and change your passwords if you shared OTPs or login details.",
];

export const PAID_PLAN_NOTE = "No step can promise to get your money back. Not legal advice.";

export interface PaidFields {
  amount: string;
  when: string;
  method: string;
  transactionId: string;
}
export const EMPTY_FIELDS: PaidFields = { amount: "", when: "", method: "", transactionId: "" };

const line = (label: string, value: string) => `${label}: ${value.trim() || "[fill in]"}`;

/**
 * The draft text. Identifiers come from the shared extractor run on the text already in the page, written
 * exactly as the user typed them (`raw`). The chat itself is not copied into the draft.
 */
export function buildComplaintDraft(text: string, fields: PaidFields): string {
  const ids = uniqueIdentifiers(extractIdentifiers(text));
  return [
    "DRAFT COMPLAINT - adapt it before sending. This is a draft, not legal advice.",
    "",
    line("Date and time of the payment", fields.when),
    line("Amount", fields.amount),
    line("Payment method (UPI, bank transfer, card, crypto...)", fields.method),
    line("Transaction ID / UTR / transaction hash", fields.transactionId),
    "",
    "Identifiers used by the other person (as written in the conversation):",
    ...(ids.length ? ids.map((i) => `- ${i.raw} (${i.type})`) : ["- [none found in the pasted text; add any you have]"]),
    "",
    "What happened, in my own words: [describe the contact, what was promised or threatened, and what you paid]",
    "Steps already taken: [1930 call reference, bank complaint number, cybercrime.gov.in acknowledgement]",
    "",
    "Prepared with ScamLens, which shows evidence, not verdicts. Not legal advice.",
  ].join("\n");
}

/** Used by the "Copy complaint draft" button. Returns false when the clipboard is blocked (the text is then shown). */
export async function copyComplaintDraft(text: string, fields: PaidFields, clipboard: Pick<Clipboard, "writeText"> | undefined): Promise<boolean> {
  try {
    if (!clipboard) return false;
    await clipboard.writeText(buildComplaintDraft(text, fields));
    return true;
  } catch {
    return false;
  }
}
