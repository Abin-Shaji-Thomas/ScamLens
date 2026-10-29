import type { CheckResponse } from "./api-schema";

export const NEXT_STEPS = [
  "Call 1930 (National Cyber Crime Helpline) as soon as possible, especially if money has left your account.",
  "File a complaint at https://cybercrime.gov.in and keep the acknowledgement number.",
  "Contact your bank or UPI app through its official helpline to block cards/UPI and dispute the transaction.",
  "Do not pay any further 'fees', 'taxes' or 'refund charges', and do not share OTPs, PINs or screen access.",
];
export const WATERMARK = "Illustrative - not a real investigation";

const STATUS_TEXT = { match: "MATCH", no_match: "not listed", info: "on-chain facts", unavailable: "UNAVAILABLE" } as const;

/** Copy-ready plain text. Tiers are kept separate; unavailable sources are stated, never treated as clean. */
export function buildEvidencePack(r: CheckResponse, opts: { demo?: boolean } = {}): string {
  const synthetic = opts.demo || r.reported.entries.some((e) => e.synthetic);
  const L: string[] = [];
  if (synthetic) L.push(`*** ${WATERMARK} ***`, "");
  L.push("SCAMLENS EVIDENCE SUMMARY", `Generated: ${r.checkedAt}`, `Overall: ${r.risk.label}`);
  for (const reason of r.risk.reasons) L.push(`  - ${reason}`);

  L.push("", "IDENTIFIERS FOUND IN THE MESSAGE");
  if (!r.identifiers.length) L.push("  (none)");
  for (const i of r.identifiers) L.push(`  - ${i.type}: ${i.value} (${i.check === "checksum" ? "checksum valid" : "format valid"})`);

  L.push("", "1. VERIFIED (checked by ScamLens against public sources)");
  if (!r.verified.length) L.push("  No verifiable addresses (UPI IDs, phones and handles have no public verified source).");
  for (const v of r.verified) {
    L.push(`  - [${STATUS_TEXT[v.status]}] ${v.sourceName} - ${v.identifier.value}`);
    L.push(`    ${v.summary}`);
    L.push(`    checked ${v.checkedAt}${v.dataAsOf ? `, list dated ${v.dataAsOf}` : ""}; source: ${v.link}`);
    if (v.note) L.push(`    note: ${v.note}`);
  }

  L.push("", "2. REPORTED (community reports, shown only with 2+ independent reporters)");
  if (r.reported.status === "unavailable") L.push(`  Reports database unavailable (${r.reported.reason}). This is not a clean result.`);
  else if (!r.reported.entries.length) L.push("  No known reports. This does not mean safe.");
  for (const e of r.reported.entries) {
    L.push(`  - ${e.display}: reported by ${e.reporters} people (${e.categories.join(", ")}), ${e.firstReported} to ${e.lastReported}${e.synthetic ? ` [${WATERMARK}]` : ""}`);
  }

  L.push("", "3. SUSPECTED (patterns in the message text; not proof)");
  if (!r.suspected.length) L.push("  No pattern signals found.");
  for (const s of r.suspected) L.push(`  - ${s.label} [rule ${s.rule_id}, ${s.source === "ai" ? "AI, quote verified" : "fixed pattern"}]: "${s.quote}"`);

  L.push("", "WHAT TO DO NEXT");
  NEXT_STEPS.forEach((s, i) => L.push(`  ${i + 1}. ${s}`));
  L.push("", "This summary is information to help you report; it is not legal advice and not a finding that any person committed a crime.");
  return L.join("\n");
}
