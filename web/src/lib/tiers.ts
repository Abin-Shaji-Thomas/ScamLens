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
