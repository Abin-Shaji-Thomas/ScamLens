import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_HUB_MAX } from "@/lib/graph";
import {
  DEFAULT_REPORTS_MAX_PER_DAY,
  MAX_IDENTIFIERS,
  MAX_TEXT_CHARS,
  MIN_INDEPENDENT_REPORTERS,
  REPORT_RETENTION_DAYS,
  USAGE_COUNTER_RETENTION_DAYS,
} from "@/lib/limits";
import { NO_REPORTS_MESSAGE } from "@/lib/risk";
import { SAMPLE_WATERMARK } from "@/lib/samples";
import { RULES } from "@/lib/signals/rules";
import { TIERS } from "@/lib/tiers";
import { usageLimits } from "@/lib/usage";
import { DEFAULT_ETHERSCAN_RPS, EVM_CHAINS } from "@/lib/verified/etherscan";
import { DOMAIN_LIST_BUDGET_BYTES, ETHERSCAN_MAX_ADDRESSES, MAX_ADDRESSES, SCAMSNIFFER_DOMAINS_PROBED_BYTES } from "@/lib/verified/index";
import { ofacList, scamSnifferList } from "@/lib/verified/lists";

export const metadata: Metadata = {
  title: "About ScamLens",
  description: "What ScamLens checks, where the data comes from, what is stored, and what to do if you have been targeted.",
};

const freeChains = EVM_CHAINS.filter((c) => c.freeTier).map((c) => c.name);
const paidChains = EVM_CHAINS.filter((c) => !c.freeTier).map((c) => c.name);
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs.join(""));
const fmtDate = (iso: string) => iso.slice(0, 10);
const n = (x: number) => x.toLocaleString("en-IN");

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-8">
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">{children}</div>
    </section>
  );
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export default function AboutPage() {
  const ofac = ofacList().meta;
  const ss = scamSnifferList().meta;
  const limits = usageLimits({});
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <p className="text-sm">
        <Link href="/" className="underline underline-offset-2">
          Back to the check
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-bold">About ScamLens</h1>

      <Section id="emergency" title="If you have already paid or shared details">
        <ol className="list-decimal pl-5">
          <li>
            Call <strong>1930</strong> (National Cyber Crime Helpline) as soon as possible.
          </li>
          <li>
            Report at <A href="https://cybercrime.gov.in">cybercrime.gov.in</A>.
          </li>
          <li>Tell your bank immediately and ask them to block or hold the transaction.</li>
          <li>Keep the chat, screenshots and transaction IDs. Do not delete them.</li>
        </ol>
      </Section>

      <Section id="what" title="What ScamLens is, and is not">
        <p>
          ScamLens looks at a message, wallet address, UPI ID or handle you paste and shows the evidence it can find, sorted
          into three separate groups. It never gives a verdict about a person and it is not legal or financial advice.
          A high risk level means &quot;stop and verify&quot;, not proof of anything.
        </p>
        <p>
          It does not see your bank account, your phone or the other person&apos;s identity. {NO_REPORTS_MESSAGE}
        </p>
      </Section>

      <Section id="tiers" title="The three tiers">
        <ul className="list-disc pl-5">
          {TIERS.map((t) => (
            <li key={t.id}>
              <strong>{t.title}:</strong> {t.description}
            </li>
          ))}
        </ul>
        <p>
          Wording rules: we describe evidence, never people. Results say &quot;reported by N independent reporters&quot;,
          &quot;linked through a shared wallet&quot; or &quot;matched list X on date Y&quot;. A source that is down is shown
          as unavailable and is never counted as a clean result.
        </p>
        <p>
          Suspected signals come from {RULES.length} fixed rules. Every quote shown is cut from your own text; if an AI pass is
          enabled it may only point at rules from that list, and any quote it gives that is not in your text is dropped.
          Identifiers (wallets, UPI IDs, phone numbers, handles) are found only by our own extractor, never by the AI.
        </p>
      </Section>

      <Section id="reports" title="How reports become visible">
        <p>
          There are no accounts. Each report is tied to a <em>network fingerprint</em>: a keyed hash (HMAC) of the IP
          address the report came from. We never store the IP itself.
        </p>
        <p>
          An identifier appears in the Reported tier only when at least {MIN_INDEPENDENT_REPORTERS} different fingerprints
          reported it within {REPORT_RETENTION_DAYS} days and nobody has contested it. One fingerprint counts once per
          identifier, and can file at most {DEFAULT_REPORTS_MAX_PER_DAY} reports per day. Graph links (for example a UPI ID
          and a Telegram handle connected through one wallet) also need two different reporters, and wallets with more
          than {DEFAULT_HUB_MAX} counterparties (such as exchanges) never link people.
        </p>
        <p>
          What this implies, honestly: people sharing one network (an office, a college, some mobile carriers) count as one
          reporter, and one person who switches networks (mobile data, Wi-Fi, a VPN) can count as more than one. Treat a
          Reported badge as a reason to verify, not as proof.
        </p>
      </Section>

      <Section id="contest" title="Contesting an entry">
        <p>
          If an identifier that belongs to you is shown as Reported, use the &quot;Contest this entry&quot; button next to it and give a
          short reason. The entry is hidden from public badges straight away until it is reviewed. Each network can
          contest at most {limits.contest} entries per day. There is no review queue yet, so a contested entry stays hidden.
        </p>
      </Section>

      <Section id="sources" title="Data sources, dates and limits">
        <ul className="list-disc pl-5">
          <li>
            <strong>{ofac.source}</strong> (US Treasury). US government work, public domain. Snapshot published{" "}
            {ofac.publish_date}, downloaded {fmtDate(ofac.fetched_at)}: {n(ofac.address_count)} crypto addresses. Only
            addresses OFAC lists are covered. <A href="https://sanctionssearch.ofac.treas.gov/">Search OFAC yourself</A>.
          </li>
          <li>
            <strong>ScamSniffer scam-database</strong>, address list ({n(ss.address_count)} addresses, upstream commit{" "}
            {ss.upstream_commit.slice(0, 7)} of {fmtDate(ss.upstream_committed_at)}). Licence: {ss.license}. {ss.delay_note}{" "}
            Data by ScamSniffer: <A href={ss.repo_url}>{ss.repo_url.replace("https://", "")}</A>.
          </li>
          <li>
            <strong>GoPlus address security API</strong>, queried live for Ethereum and TRON addresses. Flags are what GoPlus
            reports from its own sources; subject to GoPlus&apos;s terms. <A href="https://gopluslabs.io/">gopluslabs.io</A>.
          </li>
          <li>
            <strong>Etherscan V2 API</strong> (free plan): on-chain facts (type, balance, first and last transaction) for{" "}
            {list(freeChains)}. {list(paidChains)} need a paid plan and are shown as unavailable. To stay within{" "}
            {DEFAULT_ETHERSCAN_RPS} requests per second, only the first {ETHERSCAN_MAX_ADDRESSES} wallet in a message gets
            these lookups. Facts are not judgements.
          </li>
          <li>
            <strong>TronGrid</strong> (TRON mainnet): account facts for TRON addresses, with a link to Tronscan.
          </li>
          <li>
            UPI IDs, phone numbers, Telegram handles, email addresses and website domains have no verified source here: they
            can only appear in the Reported tier. ScamSniffer also publishes a domain list, but it measured{" "}
            {(SCAMSNIFFER_DOMAINS_PROBED_BYTES / 1_000_000).toFixed(1)} MB on 2026-10-29, over our{" "}
            {Math.round(DOMAIN_LIST_BUDGET_BYTES / 1024 / 1024)} MB budget for this deployment, so domains are not checked
            against it and a check with a domain says so.
          </li>
        </ul>
        <p>
          Per check we look at up to {n(MAX_TEXT_CHARS)} characters, {MAX_IDENTIFIERS} identifiers and {MAX_ADDRESSES} crypto
          addresses.
        </p>
      </Section>

      <Section id="privacy" title="Privacy: what is stored">
        <ul className="list-disc pl-5">
          <li>Checks: nothing. Your text is processed in memory and not stored or logged.</li>
          <li>
            Screenshots: shrunk in your browser, sent once to our AI provider to read the text, and not stored by ScamLens.
            The text comes back to you to edit, and only the text you confirm is checked.
          </li>
          <li>
            Reports: for each identifier a keyed hash (HMAC) and a masked display (for example <code>+91 98******10</code>), the
            scam type you chose, the network fingerprint hash, and the date. There is no free-text note field. Reports
            expire after {REPORT_RETENTION_DAYS} days.
          </li>
          <li>
            Usage limits: a hashed network key and a daily count, deleted after about {USAGE_COUNTER_RETENTION_DAYS} days.
            Daily limits per network: {limits.check} checks, {limits.transcribe} screenshots, {limits.graph} link lookups.
          </li>
          <li>Server logs hold only an event name, a status and a duration.</li>
          <li>
            Browser security rules (Content Security Policy): the page may only load scripts, styles, fonts and data from
            ScamLens itself, never from another website. Small scripts written into the page are allowed, because the
            framework we use needs them to start the app; scripts from any other site are blocked.
          </li>
        </ul>
      </Section>

      <Section id="demo" title="Demo data">
        <p>
          The sample messages and the seeded link graph are invented and always marked &quot;{SAMPLE_WATERMARK}&quot; or
          &quot;Illustrative demo data&quot;. One sample uses a wallet that really is on the OFAC list, so the Verified tier
          can be shown with live data; the chat around it is made up.
        </p>
      </Section>
    </main>
  );
}
