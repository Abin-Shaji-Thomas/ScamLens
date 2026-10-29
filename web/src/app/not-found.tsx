import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <section aria-labelledby="not-found-title">
        <div className="grid">
          <p className="t-404 col-span-full" aria-hidden="true">
            404
          </p>
          <h1 id="not-found-title" className="t-h2 col-span-full mt-8 text-swiss-black">
            Page not found
          </h1>
          <p className="col-span-full mt-4 text-swiss-text">There is nothing at this address.</p>
          <p className="col-span-full mt-8">
            <Link href="/" className="inline-flex min-h-11 items-center">
              Go to the check
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
