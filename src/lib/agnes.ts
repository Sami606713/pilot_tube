import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

let client: OpenAI | undefined;

/** Agnes AI is OpenAI-compatible, so the official OpenAI SDK works with a custom base URL. */
export function agnes(): OpenAI {
  if (!client) {
    const apiKey = process.env.AGNES_API_KEY;
    if (!apiKey) throw new Error("AGNES_API_KEY is missing in .env.local");
    client = new OpenAI({ apiKey, baseURL: process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1", timeout: 120_000, maxRetries: 2 });
  }
  return client;
}

export const agnesModel = () => process.env.AGNES_MODEL || "agnes-3.0-flash";

/** Free Agnes keys allow only a few requests per minute: on 429, wait and retry instead of failing. */
const RATE_LIMIT_WAITS = [20, 40, 60, 60];

async function complete(messages: ChatCompletionMessageParam[], temperature: number): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await agnes().chat.completions.create({ model: agnesModel(), messages, temperature });
      return res.choices[0]?.message?.content ?? "";
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status !== 429 || attempt >= RATE_LIMIT_WAITS.length) throw err;
      console.warn(`[agnes] rate limited, waiting ${RATE_LIMIT_WAITS[attempt]}s`);
      await new Promise((r) => setTimeout(r, RATE_LIMIT_WAITS[attempt] * 1000));
    }
  }
}

/** The first JSON object or array in a reply (Agnes sometimes wraps it in prose or code fences). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("no JSON in the reply");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  if (end <= start) throw new Error("unterminated JSON in the reply");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Ask Agnes for JSON and validate it with `parse` (usually a zod schema's parse).
 * Invalid replies are sent back with the error so Agnes can correct them.
 */
export async function askJson<T>(
  system: string,
  user: string,
  parse: (raw: unknown) => T,
  { temperature = 0.2, attempts = 3 }: { temperature?: number; attempts?: number } = {},
): Promise<T> {
  let messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const content = await complete(messages, temperature);
    try {
      return parse(extractJson(content));
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message.slice(0, 800) : String(err);
      console.warn(`[agnes] attempt ${attempt + 1} rejected: ${message}`);
      messages = [
        ...messages,
        { role: "assistant", content },
        { role: "user", content: `That reply was invalid: ${message}. Reply again with only the corrected JSON.` },
      ];
    }
  }
  throw new Error(`Agnes reply invalid: ${lastError instanceof Error ? lastError.message.slice(0, 300) : lastError}`);
}
