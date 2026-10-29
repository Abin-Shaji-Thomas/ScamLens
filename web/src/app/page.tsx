import { CheckForm } from "@/components/CheckForm";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">ScamLens</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Evidence-linked scam check for India. Shows what is verified, what is reported and what is only
        suspected, each with its source.
      </p>
      <div className="mt-8">
        <CheckForm />
      </div>
    </main>
  );
}
