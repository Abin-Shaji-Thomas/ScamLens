import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[40rem] px-6 pt-12 sm:pt-16">
      <h1 className="t-title">Page not found</h1>
      <p className="mt-4 text-muted">There is nothing at this address.</p>
      <p className="mt-12">
        <Link href="/">Go to the check</Link>
      </p>
    </main>
  );
}
