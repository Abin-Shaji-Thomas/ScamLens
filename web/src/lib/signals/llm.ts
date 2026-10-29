import OpenAI from "openai";
import { RULES } from "./rules";
import type { AiStatus, Signal } from "./types";
import { validateAiItems } from "./validate";

/** Returns the model's raw JSON text for a prompt. Injected so tests never call a real LLM. */
export type Completer = (system: string, user: string) => Promise<string>;

export interface LlmDeps {
  env: Record<string, string | undefined>;
  complete?: Completer;
  timeoutMs?: number;
}

const SYSTEM = [
  "You flag scam warning signs in a chat message for an Indian fraud-check tool.",
  "Only use these rule ids:",
  ...RULES.map((r) => `- ${r.id}: ${r.label}`),
  'Reply with JSON only: {"signals":[{"rule_id":"<id>","quote":"<exact words copied from the message>"}]}.',
  "Each quote must be copied character-for-character from the message, at most 200 characters.",
  'If nothing applies, reply {"signals":[]}. Never invent text.',
].join("\n");

function openAiCompleter(env: LlmDeps["env"], model: string, timeoutMs: number): Completer {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL || undefined, timeout: timeoutMs, maxRetries: 0 });
  return async (system, user) => {
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  };
}

export async function aiSignals(text: string, deps: LlmDeps): Promise<{ signals: Signal[]; ai: AiStatus }> {
  const model = deps.env.OPENAI_MODEL;
  if (!deps.complete && (!deps.env.OPENAI_API_KEY || !model)) {
    return { signals: [], ai: { status: "unavailable", reason: "OPENAI_API_KEY / OPENAI_MODEL not configured", dropped: 0 } };
  }
  const complete = deps.complete ?? openAiCompleter(deps.env, model!, deps.timeoutMs ?? 8000);
  try {
    const raw: unknown = JSON.parse(await complete(SYSTEM, text));
    const { signals, dropped } = validateAiItems(raw, text);
    return { signals, ai: { status: "ok", model: model ?? "injected", dropped } };
  } catch {
    // Never echo provider errors: they can include request details.
    return { signals: [], ai: { status: "unavailable", model, reason: "AI request failed or returned invalid JSON", dropped: 0 } };
  }
}
