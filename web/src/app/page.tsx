import { Suspense } from "react";
import { CheckForm } from "@/components/CheckForm";
import { ExampleCheckForm, type HomeSearchParams } from "@/components/ExampleCheckForm";
import { visionConfigured } from "@/lib/transcribe";

export default function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  // Evaluated on the server when the page is built; a new key in Vercel takes effect on the next deploy.
  const screenshots = visionConfigured(process.env);
  return (
    <main>
      <section aria-labelledby="page-title">
        <div className="grid">
          <h1 id="page-title" className="t-title col-span-full lg:col-span-9">
            Evidence-linked scam check for India.
          </h1>
          <p className="lead col-span-full mt-6 lg:col-span-6">
            Shows what is verified, what is reported and what is only suspected, each with its source.
          </p>
        </div>
      </section>
      {/* The prerendered shell carries the empty form; ?example= streams in the pre-filled one. */}
      <Suspense fallback={<CheckForm screenshots={screenshots} />}>
        <ExampleCheckForm searchParams={searchParams} screenshots={screenshots} />
      </Suspense>
    </main>
  );
}
