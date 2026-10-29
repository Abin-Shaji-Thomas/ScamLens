import { connection } from "next/server";
import { getHealth } from "@/lib/health";

export async function GET() {
  // Run at request time so the health check reflects the live server, not a build artifact.
  await connection();
  return Response.json(getHealth(), { headers: { "Cache-Control": "no-store" } });
}
