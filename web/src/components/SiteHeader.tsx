import Link from "next/link";
import { CurrentNavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="print:hidden">
      <div className="grid grid--bar">
        <nav aria-label="Site" className="col-span-full flex flex-wrap items-center justify-between gap-x-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-swiss-black no-underline">
            ScamLens
          </Link>
          <CurrentNavLinks />
        </nav>
      </div>
    </header>
  );
}
