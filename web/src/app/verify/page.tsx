import type { Metadata } from "next";
import { VerifyReceipt } from "@/components/VerifyReceipt";

export const metadata: Metadata = {
  title: "Verify a receipt - ScamLens",
  description: "Check that a ScamLens receipt is genuine and unchanged.",
};

export default function VerifyPage() {
  return (
    <main>
      <section aria-labelledby="verify-title">
        <div className="grid">
          <h1 id="verify-title" className="t-title col-span-full lg:col-span-9">
            Verify a receipt
          </h1>
          <p className="lead col-span-full mt-6 lg:col-span-6">
            Every check can download a signed receipt. Paste one here to confirm that ScamLens produced it and that nothing in it
            was changed. A valid receipt shows what ScamLens reported at that time, not that a chat was genuine.
          </p>
        </div>
      </section>
      <section aria-label="Receipt check">
        <div className="grid">
          <div className="col-span-full lg:col-span-8">
            <VerifyReceipt />
          </div>
        </div>
      </section>
    </main>
  );
}
