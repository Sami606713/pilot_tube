import "server-only";

/**
 * Agnes Video 2.5 Flash: text-to-video, 720×1280 (9:16), free for a limited time.
 * Its free queue is often full, so callers treat a failure as "use stock footage".
 */
const MODEL = "agnes-video-2.5-flash";

function auth() {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new Error("AGNES_API_KEY is missing in .env.local");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** Returns the video URL, or throws (queue full, failed, or slower than `timeoutMs`). */
export async function generateClip(prompt: string, seconds: number, timeoutMs = 4 * 60_000): Promise<string> {
  const base = process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1";
  const res = await fetch(`${base}/videos`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ model: MODEL, prompt, mode: "text", size: "720P", aspect_ratio: "9:16", seconds: String(Math.min(12, Math.max(4, Math.ceil(seconds)))) }),
    signal: AbortSignal.timeout(60_000),
  });
  const created = (await res.json().catch(() => ({}))) as { video_id?: string; id?: string; code?: string; message?: string };
  const id = created.video_id ?? created.id;
  if (!res.ok || !id) throw new Error(created.message ?? created.code ?? `Agnes video failed (${res.status})`);

  const deadline = Date.now() + timeoutMs;
  const host = new URL(base).origin;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${host}/agnesapi?video_id=${encodeURIComponent(id)}&model_name=${MODEL}`, { headers: auth(), signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!poll?.ok) continue;
    const p = (await poll.json().catch(() => ({}))) as { status?: string; url?: string; error?: unknown };
    if (p.status === "completed" && p.url) return p.url;
    if (p.status === "failed") throw new Error(`Agnes video failed: ${JSON.stringify(p.error ?? "")}`.slice(0, 200));
  }
  throw new Error("Agnes video took too long");
}
