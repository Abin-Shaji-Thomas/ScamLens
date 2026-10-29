import type { IdentifierType } from "../extract/types";

const keep = (s: string, head: number, tail: number) =>
  s.length <= head + tail ? `${s.slice(0, 1)}***` : `${s.slice(0, head)}***${s.slice(s.length - tail)}`;

/** Masked form for public views. Never reversible to the full identifier. */
export function maskIdentifier(type: IdentifierType, value: string): string {
  switch (type) {
    case "upi":
    case "email": {
      const [local, domain] = value.split("@");
      return `${keep(local, 2, 1)}@${domain}`;
    }
    case "phone":
      return `+91 ${value.slice(3, 5)}******${value.slice(-2)}`;
    case "telegram":
      return `@${keep(value.slice(1), 2, 2)}`;
    case "domain":
      return keep(value, 3, 4);
    default:
      return keep(value, 6, 4); // wallets
  }
}
