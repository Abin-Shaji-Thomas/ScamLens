// Downloads the OFAC SDN list and the ScamSniffer address blacklist and writes
// versioned JSON snapshots to web/data/. Run: npx tsx scripts/sync-lists.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { OfacSnapshot, ScamSnifferSnapshot } from "../src/lib/verified/lists-schema";

const OFAC_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML";
const SS_REPO = "https://github.com/scamsniffer/scam-database";
const SS_URL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/all.json";
const SS_COMMITS = "https://api.github.com/repos/scamsniffer/scam-database/commits?path=blacklist/all.json&per_page=1";
const DATA_DIR = join(import.meta.dirname, "..", "data");

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": "ScamLens-sync", ...headers } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res;
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const SdnId = z.object({ idType: z.string().optional(), idNumber: z.string().optional() });
const SdnEntry = z.object({
  uid: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  programList: z.object({ program: z.array(z.string()).optional() }).optional(),
  idList: z.object({ id: z.array(SdnId).optional() }).optional(),
});
const SdnDoc = z.object({
  sdnList: z.object({
    publshInformation: z.object({ Publish_Date: z.string(), Record_Count: z.string() }),
    sdnEntry: z.array(SdnEntry),
  }),
});

async function syncOfac(): Promise<OfacSnapshot> {
  const xml = await (await get(OFAC_URL)).text();
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false, // keep addresses and ids as strings
    isArray: (name) => ["sdnEntry", "id", "program"].includes(name),
  });
  const doc = SdnDoc.parse(parser.parse(xml));
  const addresses: OfacSnapshot["addresses"] = [];
  for (const entry of doc.sdnList.sdnEntry) {
    for (const id of asArray(entry.idList?.id)) {
      const prefix = "Digital Currency Address - ";
      if (!id.idType?.startsWith(prefix) || !id.idNumber) continue;
      addresses.push({
        address: id.idNumber.trim(),
        currency: id.idType.slice(prefix.length).trim(),
        sdn_uid: entry.uid,
        sdn_name: [entry.firstName, entry.lastName].filter(Boolean).join(" "),
        programs: asArray(entry.programList?.program),
      });
    }
  }
  if (addresses.length < 100) throw new Error(`OFAC: only ${addresses.length} addresses parsed; refusing to write`);
  return OfacSnapshot.parse({
    schema_version: 1,
    source: "OFAC Specially Designated Nationals (SDN) List",
    source_url: OFAC_URL,
    fetched_at: new Date().toISOString(),
    publish_date: doc.sdnList.publshInformation.Publish_Date,
    record_count: Number(doc.sdnList.publshInformation.Record_Count),
    address_count: addresses.length,
    addresses,
  });
}

const GithubCommits = z.array(
  z.object({ sha: z.string(), commit: z.object({ committer: z.object({ date: z.string() }) }) }),
).min(1);
const AllJson = z.object({ address: z.array(z.unknown()) });

async function syncScamSniffer(): Promise<ScamSnifferSnapshot> {
  const [commits, all] = await Promise.all([
    get(SS_COMMITS, { Accept: "application/vnd.github+json" }).then(async (r) => GithubCommits.parse(await r.json())),
    get(SS_URL).then(async (r) => AllJson.parse(await r.json())),
  ]);
  const valid = new Set<string>();
  let skipped = 0;
  for (const a of all.address) {
    const s = typeof a === "string" ? a.trim() : "";
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) valid.add(s.toLowerCase());
    else skipped++;
  }
  if (valid.size < 100) throw new Error(`ScamSniffer: only ${valid.size} addresses; refusing to write`);
  return ScamSnifferSnapshot.parse({
    schema_version: 1,
    source: "ScamSniffer scam-database (blacklist/all.json, address list)",
    source_url: SS_URL,
    repo_url: SS_REPO,
    license: "GPL-3.0 (upstream repository license)",
    fetched_at: new Date().toISOString(),
    upstream_commit: commits[0].sha,
    upstream_committed_at: new Date(commits[0].commit.committer.date).toISOString(),
    delay_note: "Public copy is about 7 days delayed versus ScamSniffer's live feed.",
    address_count: valid.size,
    skipped_invalid: skipped,
    addresses: [...valid].sort(),
  });
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const [ofac, ss] = await Promise.all([syncOfac(), syncScamSniffer()]);
  writeFileSync(join(DATA_DIR, "ofac-sdn-addresses.json"), JSON.stringify(ofac, null, 1) + "\n");
  writeFileSync(join(DATA_DIR, "scamsniffer-addresses.json"), JSON.stringify(ss, null, 1) + "\n");
  const byCurrency: Record<string, number> = {};
  for (const a of ofac.addresses) byCurrency[a.currency] = (byCurrency[a.currency] ?? 0) + 1;
  console.log(`OFAC: published ${ofac.publish_date}, ${ofac.record_count} SDN records, ${ofac.address_count} addresses`);
  console.log(`      by currency: ${JSON.stringify(byCurrency)}`);
  console.log(
    `ScamSniffer: ${ss.address_count} addresses (${ss.skipped_invalid} invalid skipped), upstream commit ${ss.upstream_commit.slice(0, 7)} at ${ss.upstream_committed_at}`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
