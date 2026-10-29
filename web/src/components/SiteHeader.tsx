import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="print:hidden">
      <div className="grid grid--bar">
        <nav aria-label="Site" className="col-span-full flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold text-swiss-black no-underline">
            ScamLens
          </Link>
          <Link href="/about" className="inline-flex min-h-11 min-w-11 items-center justify-end text-swiss-text no-underline hover:underline">
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
