import { CheckForm } from "@/components/CheckForm";

export default function Home() {
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
      <CheckForm />
    </main>
  );
}
