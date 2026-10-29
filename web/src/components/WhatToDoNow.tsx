import { WHAT_TO_DO_NOW } from "@/lib/next-steps";

export function WhatToDoNow() {
  return (
    <section aria-labelledby="what-to-do">
      <h3 id="what-to-do" className="t-h2">
        What to do now
      </h3>
      <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5">
        {WHAT_TO_DO_NOW.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}
