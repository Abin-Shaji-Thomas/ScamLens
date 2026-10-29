import ofacJson from "../../../data/ofac-sdn-addresses.json";
import ssJson from "../../../data/scamsniffer-addresses.json";
import { normaliseAddress, OfacSnapshot, ScamSnifferSnapshot } from "./lists-schema";

type OfacEntry = OfacSnapshot["addresses"][number];

let ofac: { meta: OfacSnapshot; byAddress: Map<string, OfacEntry[]> } | undefined;
let scamSniffer: { meta: ScamSnifferSnapshot; set: Set<string> } | undefined;

export function ofacList() {
  if (!ofac) {
    const meta = OfacSnapshot.parse(ofacJson);
    const byAddress = new Map<string, OfacEntry[]>();
    for (const e of meta.addresses) {
      const key = normaliseAddress(e.address);
      byAddress.set(key, [...(byAddress.get(key) ?? []), e]);
    }
    ofac = { meta, byAddress };
  }
  return ofac;
}

export function scamSnifferList() {
  if (!scamSniffer) {
    const meta = ScamSnifferSnapshot.parse(ssJson);
    scamSniffer = { meta, set: new Set(meta.addresses) };
  }
  return scamSniffer;
}
