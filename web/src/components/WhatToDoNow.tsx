import { WHAT_TO_DO_NOW } from "@/lib/next-steps";

export function WhatToDoNow() {
  return (
    <section aria-labelledby="what-to-do" className="rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
      <h3 id="what-to-do" className="text-base font-semibold">
        What to do now
      </h3>
      <ol className="mt-2 list-decimal pl-5 text-sm">
        {WHAT_TO_DO_NOW.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}
