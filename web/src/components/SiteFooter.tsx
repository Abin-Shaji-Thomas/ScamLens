import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto print:hidden">
      <div className="grid grid--bar pb-10">
        <div className="t-small col-span-full flex flex-wrap items-center gap-x-8 gap-y-2 border-t-2 border-swiss-black pt-4 text-swiss-text">
          <Link href="/about" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black">
            About
          </Link>
          <Link href="/patterns" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black">
            Patterns
          </Link>
          <Link href="/verify" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black">
            Verify a receipt
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black">
            Privacy
          </Link>
          <span>Not legal advice</span>
          <span>
            Lost money? Call <span className="font-semibold text-swiss-black">1930</span> or report at cybercrime.gov.in, and tell your bank now.
          </span>
        </div>
      </div>
    </footer>
  );
}
