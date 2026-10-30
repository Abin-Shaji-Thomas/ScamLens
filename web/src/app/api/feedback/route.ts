import { feedbackResponse } from "@/lib/cases/routes";

// "Was this right?": a verdict and fixed reason codes per identifier. Display only; never changes a level.
export async function POST(request: Request) {
  return feedbackResponse(request, { env: process.env });
}
