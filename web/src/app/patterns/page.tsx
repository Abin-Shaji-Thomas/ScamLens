import type { Metadata } from "next";
import Link from "next/link";
import { exampleHref } from "@/lib/pattern-example";
import { PATTERN_GUIDE } from "@/lib/signals/pattern-guide";
import { RULES } from "@/lib/signals/rules";
import type { Rule } from "@/lib/signals/types";

export const metadata: Metadata = {
  title: "Patterns - ScamLens",
  description: "The fixed patterns ScamLens looks for in a message, what they mean and what to do. Patterns, not verdicts.",
};

/** When a hit is not counted, generated from the rule's own guards in rules.ts. */
function exclusions(rule: Rule, extra?: string): string[] {
  const out: string[] = [];
  if (extra) out.push(extra);
  if (rule.negatable) out.push("A negation earlier in the same sentence cancels it (\"never share your OTP\").");
  if (rule.adjacentNegation) out.push("A negation right before it cancels it (\"does not guarantee\").");
  if (rule.needsCorroboration) out.push("It counts only when a second, different pattern is also found.");
  out.push(
    "Inside a sentence that warns about scams (\"beware\", \"red flag\", \"police said\", \"If someone says ..., it is a fraud\") it is shown but not counted, unless that sentence also asks you to pay, send, join or click.",
  );
  return out;
}

export default function PatternsPage() {
  return (
    <main>
      <section aria-labelledby="patterns-title">
        <div className="grid">
          <p className="eyebrow col-span-full">
            <Link href="/" className="inline-flex min-h-11 items-center text-swiss-text">
              Back to the check
            </Link>
          </p>
          <h1 id="patterns-title" className="t-title col-span-full mt-4 lg:col-span-9">
            Patterns
          </h1>
          <p className="lead col-span-full mt-6 lg:col-span-6">
            These are patterns, not verdicts. ScamLens looks for {RULES.length} fixed patterns in the text you paste; each one is a
            warning sign that often appears in scam messages, and none of them proves anything about a person on its own.
          </p>
          <p className="col-span-full mt-8">
            <Link href="/" className="button" data-check-link>
              Check a message
            </Link>
          </p>
        </div>
      </section>
      {RULES.map((rule, i) => {
        const g = PATTERN_GUIDE[rule.id];
        return (
          <section key={rule.id} id={rule.id} aria-labelledby={`${rule.id}-h`} className={i % 2 === 1 ? "band" : undefined}>
            <div className="grid">
              <div className="col-span-full lg:col-span-4">
                <p className="eyebrow" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h2 id={`${rule.id}-h`} className="t-h2 mt-2">
                  {g.name}
                </h2>
                <p className="t-small mt-2 text-swiss-text">
                  rule <code>{rule.id}</code>
                </p>
              </div>
              <dl className="col-span-full mt-6 flex flex-col gap-4 lg:col-span-7 lg:col-start-5 lg:mt-0">
                <div>
                  <dt className="font-semibold">What it looks like</dt>
                  <dd className="mt-1 text-swiss-text">{g.looksLike}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Why such messages use it</dt>
                  <dd className="mt-1 text-swiss-text">{g.why}</dd>
                </div>
                <div>
                  <dt className="font-semibold">What to do</dt>
                  <dd className="mt-1 text-swiss-text">{g.whatToDo}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Illustrative example</dt>
                  <dd className="mt-1">&ldquo;{g.example}&rdquo;</dd>
                  <dd className="mt-1">
                    <Link href={exampleHref(rule.id)} className="inline-flex min-h-11 items-center" data-try={rule.id}>
                      Try this example
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">When it is not a signal</dt>
                  <dd className="mt-1">
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-swiss-text">
                      {exclusions(rule, g.notASignal).map((e, k) => (
                        <li key={k}>{e}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">How it counts</dt>
                  <dd className="mt-1 text-swiss-text">
                    One counted pattern, however many times it appears. Patterns alone can raise the level to Elevated, never to
                    High.
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        );
      })}
    </main>
  );
}
