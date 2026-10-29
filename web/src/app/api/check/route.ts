import { CheckRequest, runCheck } from "@/lib/check";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON: {\"text\": \"...\"}" }, { status: 400 });
  }
  const parsed = CheckRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const result = await runCheck(parsed.data);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
