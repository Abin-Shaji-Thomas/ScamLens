import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-[40rem] px-6 pb-10 pt-16 print:hidden">
      <div className="t-small flex flex-wrap gap-x-6 gap-y-2 border-t border-hairline pt-6 text-muted">
        <Link href="/about" className="text-muted">
          About
        </Link>
        <span>Not legal advice</span>
        <span>
          Lost money? Call <span className="font-semibold text-ink">1930</span> or report at cybercrime.gov.in, and tell your bank now.
        </span>
      </div>
    </footer>
  );
}
