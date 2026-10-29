import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-[40rem] px-6 pb-10 pt-16 print:hidden">
      <div className="t-small flex flex-wrap gap-x-6 gap-y-2 border-t border-swiss-rule pt-6 text-swiss-text">
        <Link href="/about" className="text-swiss-text">
          About
        </Link>
        <span>Not legal advice</span>
        <span>
          Lost money? Call <span className="font-semibold text-swiss-black">1930</span> or report at cybercrime.gov.in, and tell your bank now.
        </span>
      </div>
    </footer>
  );
}
