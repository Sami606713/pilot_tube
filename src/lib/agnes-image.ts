import "server-only";
import { writeFile } from "node:fs/promises";
import { env } from "@/lib/env";

/** Agnes Image 2.5 Flash: best of the Agnes image models, free at the time of writing. */
export const AGNES_IMAGE_MODEL = "agnes-image-2.5-flash";

export type AgnesRatio = "9:16" | "16:9" | "1:1";

// Free Agnes keys are rate limited per minute; on 429 wait and try again instead of failing.
const RATE_LIMIT_WAITS_MS = [15_000, 30_000, 45_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Draw one 2K picture with Agnes and save it to `outPath` (Agnes output links are temporary). */
export async function generateAgnesImage(prompt: string, ratio: AgnesRatio, outPath: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateOnce(prompt, ratio, outPath);
    } catch (err) {
      const wait = RATE_LIMIT_WAITS_MS[attempt];
      if (!(err instanceof RateLimitError) || wait === undefined) throw err;
      await sleep(wait);
    }
  }
}

class RateLimitError extends Error {}

async function generateOnce(prompt: string, ratio: AgnesRatio, outPath: string): Promise<void> {
  const res = await fetch(`${env().AGNES_BASE_URL}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env().AGNES_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AGNES_IMAGE_MODEL,
      // Repeated on every call because image models sometimes draw words; real text is added by PilotTube.
      prompt: `${prompt}. No text, no letters, no words, no logos, no watermark.`,
      size: "2K",
      ratio,
      extra_body: { response_format: "url" },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { url?: string }[]; error?: { message?: string } };
  const url = body.data?.[0]?.url;
  if (res.status === 429) throw new RateLimitError(`Agnes rate limit for free keys: ${body.error?.message ?? "too many requests"}`);
  if (!res.ok || !url) throw new Error(`Agnes image failed (${res.status}): ${body.error?.message ?? "no image returned"}`);

  const image = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!image.ok) throw new Error(`Downloading the Agnes image failed (${image.status})`);
  await writeFile(outPath, Buffer.from(await image.arrayBuffer()));
}
