export type TierId = "verified" | "reported" | "suspected";

export interface TierInfo {
  id: TierId;
  title: string;
  description: string;
  emptyText: string;
}

// Copy for the three evidence tiers. Tiers are never mixed (docs/SPEC.md).
export const TIERS: readonly TierInfo[] = [
  {
    id: "verified",
    title: "Verified",
    description:
      "Facts we check ourselves: on-chain history, OFAC sanctions list, ScamSniffer blacklist (public copy is about 7 days delayed) and GoPlus address security.",
    emptyText: "No verified matches. Sources that fail are shown as unavailable, never as safe.",
  },
  {
    id: "reported",
    title: "Reported",
    description: "Community reports, shown only after 2 independent submitters. UPI IDs are user-reported only.",
    emptyText: "No known reports. This does not mean safe.",
  },
  {
    id: "suspected",
    title: "Suspected",
    description: "Pattern signals found in your text, each with the exact quoted phrase and the rule that fired.",
    emptyText: "No pattern signals yet.",
  },
];

/** Shown under the Suspected tier when no AI key is configured (the deployment's normal state). */
export const RULES_ONLY_NOTE = "Suspected signals come from fixed pattern rules only.";

/** Shown next to a Reported entry that someone contested (G2). The entry stays visible. */
export const CONTESTED_LABEL = "Contested, under review";
export const CONTESTED_NOTE = "Someone disputes this entry. It is still shown, but it does not count toward a high risk level until a person reviews it.";

/** Collapsed group for suspected hits that sit inside warning, news or awareness sentences (G3). */
export const WARNING_CONTEXT_TITLE = "Mentioned in a warning or news-style text";
export const WARNING_CONTEXT_NOTE =
  "These phrases appear in a sentence that warns about scams or reports on them, so they are not counted toward the risk level.";
