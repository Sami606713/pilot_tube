import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | undefined;

/** Agnes AI is OpenAI-compatible, so the official OpenAI SDK works with a custom base URL. */
export function agnes(): OpenAI {
  if (!client) {
    const { AGNES_API_KEY, AGNES_BASE_URL } = env();
    client = new OpenAI({ apiKey: AGNES_API_KEY, baseURL: AGNES_BASE_URL });
  }
  return client;
}
