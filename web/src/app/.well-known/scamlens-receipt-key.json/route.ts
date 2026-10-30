import { connection } from "next/server";
import { keyResponse } from "@/lib/receipts";

// The public key that checks ScamLens receipts (/verify). 404 when receipts are off.
export async function GET() {
  await connection();
  return keyResponse(process.env);
}
