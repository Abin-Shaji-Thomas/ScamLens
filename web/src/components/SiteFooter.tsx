import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-2xl border-t border-neutral-200 px-4 py-6 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400 print:hidden">
      <p>
        ScamLens shows evidence, not verdicts. Lost money? Call <strong>1930</strong> or report at cybercrime.gov.in, and tell
        your bank now.{" "}
        <Link href="/about" className="underline underline-offset-2">
          About, sources and privacy
        </Link>
      </p>
    </footer>
  );
}
