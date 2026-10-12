import "server-only";
import { z } from "zod";

const schema = z.object({
  AGNES_API_KEY: z.string().min(1, "AGNES_API_KEY is missing in .env.local"),
  AGNES_BASE_URL: z.string().url().default("https://apihub.agnes-ai.com/v1"),
  AGNES_MODEL: z.string().default("agnes-2.0-flash"),
  DEEPGRAM_API_KEY: z.string().optional(),
  DATA_DIR: z.string().default("data"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
    }
    cached = parsed.data;
  }
  return cached;
}
