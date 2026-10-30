"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "/patterns", label: "Patterns" },
  { href: "/verify", label: "Verify a receipt" },
  { href: "/about", label: "About" },
];

/** The header's text links; the current page is marked with aria-current. Each has a 44 px tap area. */
export function NavLinks({ current }: { current: string | null }) {
  return (
    <ul className="flex flex-wrap items-center justify-end gap-x-6">
      {NAV_LINKS.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            aria-current={current === l.href ? "page" : undefined}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center no-underline hover:underline ${current === l.href ? "text-swiss-black underline" : "text-swiss-text"}`}
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CurrentNavLinks() {
  return <NavLinks current={usePathname()} />;
}
