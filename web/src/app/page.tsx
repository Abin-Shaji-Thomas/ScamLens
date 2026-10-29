import { CheckForm } from "@/components/CheckForm";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[40rem] px-6 pt-12 sm:pt-16">
      <h1 className="t-title">Evidence-linked scam check for India.</h1>
      <p className="mt-4 text-swiss-text">
        Shows what is verified, what is reported and what is only suspected, each with its source.
      </p>
      <div className="mt-12 sm:mt-16">
        <CheckForm />
      </div>
    </main>
  );
}
