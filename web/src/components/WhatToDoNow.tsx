import { WHAT_TO_DO_NOW } from "@/lib/next-steps";
import { PaidPlan } from "./PaidPlan";

/** A paper band: heading on the left (columns 1-4), numbered steps on the right (5-12), then "I already paid". */
export function WhatToDoNow({ text = "" }: { text?: string }) {
  return (
    <section aria-labelledby="what-to-do" className="band">
      <div className="grid">
        <h2 id="what-to-do" className="t-h2 col-span-full lg:col-span-4">
          What to do now
        </h2>
        <ol className="steps col-span-full mt-8 flex flex-col gap-6 lg:col-span-8 lg:col-start-5 lg:mt-0">
          {WHAT_TO_DO_NOW.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <div className="col-span-full mt-10 lg:col-span-8 lg:col-start-5">
          <PaidPlan text={text} />
        </div>
      </div>
    </section>
  );
}
