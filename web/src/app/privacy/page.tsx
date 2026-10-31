import type { Metadata } from "next";
import { DeleteCaseForm } from "@/components/DeleteCaseForm";
import { STORAGE_PROMISE } from "@/lib/privacy-copy";

export const metadata: Metadata = {
  title: "Privacy - ScamLens",
  description: "What ScamLens stores, why, for how long, and how to delete a case you contributed. Your check is never stored.",
};

// Mirrors docs/PRIVACY.md (the data inventory); a test keeps the promise identical in both.
const INVENTORY: { what: string; when: string; kept: string; who: string }[] = [
  { what: "A check", when: "Never stored: the text is processed in memory only.", kept: "Not stored", who: "Nobody" },
  { what: "A report", when: "You press Report with consent: a keyed hash and a masked form per identifier, the scam type, a keyed hash of your network address (never the IP), the date.", kept: "90 days", who: "Counts and masked forms on the site, once 2 networks report the same identifier" },
  { what: "A contributed case", when: "You press \"Add it to the map\" with consent: the reports above plus type, channel, loss band, month, which patterns fired, and a keyed hash of your delete code.", kept: "90 days", who: "Counts only on the site" },
  { what: "A redacted excerpt", when: "Only if you tick it twice, after seeing the exact text: at most 500 characters with identifiers and long numbers removed.", kept: "90 days, or until you delete it", who: "The moderator only; never shown on the site, in receipts, evidence packs or logs" },
  { what: "A \"Was this right?\" answer", when: "You choose scam, genuine or not sure, with fixed reasons; no free text.", kept: "90 days", who: "Counts only, next to reported entries; never changes a level" },
  { what: "A contest", when: "You contest an entry: its keyed hash and your reason.", kept: "Until resolved, at most 90 days", who: "The moderator only" },
  { what: "Usage counters", when: "Every limited request: a hashed network key and a daily count.", kept: "About 7 days", who: "Nobody; /about shows the 7-day total of checks" },
  { what: "Server logs", when: "Every request: an event name, a status and a duration.", kept: "Hosting log retention", who: "The owner" },
];

export default function PrivacyPage() {
  return (
    <main>
      <section aria-labelledby="privacy-title">
        <div className="grid">
          <h1 id="privacy-title" className="t-title col-span-full lg:col-span-9">
            Privacy
          </h1>
          <p className="lead col-span-full mt-6 lg:col-span-7" data-promise>
            {STORAGE_PROMISE}
          </p>
        </div>
      </section>
      <section aria-labelledby="inventory-h">
        <div className="grid">
          <h2 id="inventory-h" className="t-h2 col-span-full lg:col-span-4">
            What is stored
          </h2>
          <ul className="col-span-full mt-6 flex flex-col divide-y divide-swiss-rule border-y border-swiss-rule lg:col-span-7 lg:col-start-5 lg:mt-0">
            {INVENTORY.map((r) => (
              <li key={r.what} className="flex flex-col gap-1 py-4">
                <p className="font-semibold text-swiss-black">{r.what}</p>
                <p className="text-swiss-text">{r.when}</p>
                <p className="t-small text-swiss-text">
                  Kept: {r.kept}. Who can see it: {r.who}.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section id="delete" aria-labelledby="delete-h" className="band">
        <div className="grid">
          <h2 id="delete-h" className="t-h2 col-span-full lg:col-span-4">
            Delete a case
          </h2>
          <div className="col-span-full mt-6 flex flex-col gap-4 lg:col-span-7 lg:col-start-5 lg:mt-0">
            <p>Enter the delete code you got when you added the case. It deletes the case and its excerpt at once.</p>
            <DeleteCaseForm />
          </div>
        </div>
      </section>
    </main>
  );
}
