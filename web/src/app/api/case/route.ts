import { caseResponse } from "@/lib/cases/routes";

// Contribute a case (consent required). Returns the delete code once; never echoes the excerpt.
export async function POST(request: Request) {
  return caseResponse(request, { env: process.env });
}
