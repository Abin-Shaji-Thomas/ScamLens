import { getDomain } from "tldts";
import { z } from "zod";
import type { Identifier } from "../extract/types";
import { getJson, Unavailable } from "./http";
import type { CheckDeps, SourceResult } from "./types";

const Response = z.object({
  code: z.number(),
  message: z.string().optional(),
  result: z.record(z.string(), z.string()).nullable().optional(),
});

// Fields in the GoPlus response that are metadata, not risk flags.
const NOT_FLAGS = new Set(["contract_address", "data_source", "number_of_malicious_contracts_created"]);

export async function checkGoPlus(id: Identifier, deps: CheckDeps): Promise<SourceResult> {
  const chain = id.type === "tron" ? "tron" : "1";
  const url = `https://api.gopluslabs.io/api/v1/address_security/${id.value}?chain_id=${chain}`;
  const body = Response.safeParse(await getJson(deps, url));
  if (!body.success || !body.data.result) throw new Unavailable("invalid response");
  if (body.data.code !== 1) throw new Unavailable(`GoPlus code ${body.data.code}`);

  const r = body.data.result;
  const flags = Object.entries(r)
    .filter(([k, v]) => !NOT_FLAGS.has(k) && v === "1")
    .map(([k]) => k.replaceAll("_", " "));
  const malicious = Number(r.number_of_malicious_contracts_created ?? "0");
  if (malicious > 0) flags.push(`created ${malicious} malicious contract(s)`);
  const dataSource = r.data_source ? ` (data source: ${r.data_source})` : "";
  return {
    source: "goplus",
    sourceName: "GoPlus address security",
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    link: url,
    status: flags.length ? "match" : "no_match",
    summary: flags.length
      ? `GoPlus flags this address: ${flags.join(", ")}${dataSource}.`
      : "GoPlus returned no risk flags for this address.",
    facts: flags.map((f) => ({ label: "Flag", value: f })),
  };
}

/** eTLD+1 of a hostname (the part a person registers); the hostname itself when tldts cannot tell. */
export const registrableDomain = (host: string) => getDomain(host) ?? host;

const PhishingResponse = z.object({
  code: z.number(),
  message: z.string().optional(),
  result: z.object({ phishing_site: z.number() }).passthrough().nullable().optional(),
});

/**
 * Website domains against GoPlus's phishing-site list (probed 2026-10-30: free, no key; a documented phishing domain
 * returns 1, example.com 0). Only the domain is sent, never the message.
 */
export async function checkGoPlusPhishing(id: Identifier, deps: CheckDeps): Promise<SourceResult> {
  // Only the registrable domain is sent ("login.bank-kyc.example.com" -> "example.com"), never the path or subdomains.
  const domain = registrableDomain(id.value);
  const url = `https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(domain)}`;
  const body = PhishingResponse.safeParse(await getJson(deps, url));
  if (!body.success || !body.data.result) throw new Unavailable("invalid response");
  if (body.data.code !== 1) throw new Unavailable(`GoPlus code ${body.data.code}`);
  const listed = body.data.result.phishing_site === 1;
  return {
    source: "goplus_phishing",
    sourceName: "GoPlus phishing sites",
    identifier: { type: id.type, value: id.value },
    checkedAt: deps.now().toISOString(),
    link: url,
    status: listed ? "match" : "no_match",
    summary: listed ? "GoPlus lists this website as a phishing site." : "GoPlus does not list this website as a phishing site.",
    facts: listed ? [{ label: "Flag", value: "phishing site" }] : [],
  };
}
