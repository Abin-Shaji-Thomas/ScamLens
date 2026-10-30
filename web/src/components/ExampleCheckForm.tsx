import { patternExample } from "@/lib/pattern-example";
import { CheckForm } from "./CheckForm";

export type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Server part of the home form: reads ?example=<rule_id> (from "Try this example" on /patterns) and passes the
 * validated example to CheckForm, which fills the box but never runs the check. Rendered inside <Suspense> so the
 * rest of the page stays prerendered.
 */
export async function ExampleCheckForm({ searchParams, screenshots }: { searchParams: HomeSearchParams; screenshots: boolean }) {
  const example = patternExample((await searchParams).example);
  return <CheckForm screenshots={screenshots} example={example} />;
}
