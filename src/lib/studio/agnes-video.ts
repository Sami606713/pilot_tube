import "server-only";
import { checkClip, submitClip } from "@/lib/clips/agnes-video";

/** One quick attempt at an AI clip for a studio line (the Clips page does long, patient retries). */
export async function generateClip(prompt: string, seconds: number, timeoutMs = 4 * 60_000): Promise<string> {
  const model = "agnes-video-2.5-flash";
  const id = await submitClip({ model, prompt, shape: "9:16", seconds });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await checkClip(id, model);
    if (s?.status === "completed" && s.url) return s.url;
    if (s?.status === "failed") throw new Error(`Agnes video failed: ${s.error ?? ""}`);
  }
  throw new Error("Agnes video took too long");
}
