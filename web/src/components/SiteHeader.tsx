import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[40rem] items-baseline justify-between px-6 pt-8 print:hidden">
      <Link href="/" className="font-semibold no-underline">
        ScamLens
      </Link>
      <Link href="/about" className="text-swiss-text no-underline hover:underline">
        About
      </Link>
    </header>
  );
}
