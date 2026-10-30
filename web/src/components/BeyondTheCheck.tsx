import Link from "next/link";
import { RULES } from "@/lib/signals/rules";

export const BEYOND_ITEMS: readonly { title: string; text: string; href: string; link: string }[] = [
  { title: "Patterns", text: `Learn the tactics behind these messages. ${RULES.length} patterns, with examples and what to do.`, href: "/patterns", link: "See the patterns" },
  { title: "Verify a receipt", text: "Got a ScamLens receipt from a friend or a bank? Check that nobody edited it.", href: "/verify", link: "Verify a receipt" },
  { title: "About", text: "What we store, where the facts come from, and what we do not know.", href: "/about", link: "Read about ScamLens" },
];

/** "Beyond the check": the three other places, under the form. Hidden in print. */
export function BeyondTheCheck() {
  return (
    <section aria-labelledby="beyond-title" className="print:hidden">
      <div className="grid gap-y-10">
        <h2 id="beyond-title" className="t-h2 col-span-full">
          Beyond the check
        </h2>
        {BEYOND_ITEMS.map((i) => (
          <div key={i.href} className="card col-span-full flex flex-col lg:col-span-4" data-beyond={i.href}>
            <h3 className="font-semibold text-swiss-black">{i.title}</h3>
            <p className="mt-2 text-swiss-text">{i.text}</p>
            <p className="mt-2">
              <Link href={i.href} className="inline-flex min-h-11 items-center">
                {i.link}
              </Link>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
