import { deleteCaseResponse } from "@/lib/cases/routes";

// Delete a contributed case (and, if asked, its reports) with the delete code shown when it was saved.
export async function POST(request: Request) {
  return deleteCaseResponse(request, { env: process.env });
}
