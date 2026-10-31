import Link from "next/link";
import { CONTACT_EMAIL, CONTACT_MAILTO, X_HANDLE, X_URL } from "@/lib/contact";

export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div className="grid grid--bar pb-10">
        <div className="t-small col-span-full flex flex-wrap items-center gap-x-8 gap-y-2 border-t-2 border-swiss-black pt-4 text-swiss-text">
          <Link href="/about" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black print:hidden">
            About
          </Link>
          <Link href="/patterns" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black print:hidden">
            Patterns
          </Link>
          <Link href="/verify" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black print:hidden">
            Verify a receipt
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black print:hidden">
            Privacy
          </Link>
          {/* Contact stays on paper: the print stylesheet shows the address and handle as plain black text. */}
          <a href={CONTACT_MAILTO} className="inline-flex min-h-11 min-w-11 items-center text-swiss-black" data-contact-email>
            Contact<span className="hidden print:inline">: {CONTACT_EMAIL}</span>
          </a>
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center text-swiss-black" data-contact-x>
            {X_HANDLE} on X
          </a>
          <span>Not legal advice</span>
          <span>
            Lost money? Call <span className="font-semibold text-swiss-black">1930</span> or report at cybercrime.gov.in, and tell your bank now.
          </span>
        </div>
      </div>
    </footer>
  );
}
