import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";
import { X_HANDLE } from "@/lib/contact";

const TITLE = "ScamLens";
const DESCRIPTION = "Evidence-linked scam check for India: verified, reported and suspected signals, each with its source.";

/** Optional NEXT_PUBLIC_SITE_URL (not a secret) makes share-image URLs absolute; ignored when missing or invalid. */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL | undefined {
  try {
    return env.NEXT_PUBLIC_SITE_URL ? new URL(env.NEXT_PUBLIC_SITE_URL) : undefined;
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: TITLE, type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, site: X_HANDLE, creator: X_HANDLE },
};

// System font stack only (no web fonts): fast, private and no extra requests.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-swiss-white text-swiss-black antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
