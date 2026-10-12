import "server-only";

/**
 * Agnes Video 2.5 / 2.5 Flash: 4-12 second clips from text or from a first-frame picture.
 * The free queue is often full: callers retry QueueFullError later.
 * Docs: https://wiki.agnes-ai.com/en/docs/agnes-video-25-flash
 */
export type VideoModel = "agnes-video-2.5-flash" | "agnes-video-2.5";
export const VIDEO_MODELS: Record<VideoModel, { label: string; size: "720P" | "1080P" }> = {
  "agnes-video-2.5-flash": { label: "Flash · 720p · free now", size: "720P" },
  "agnes-video-2.5": { label: "2.5 · 1080p · may cost", size: "1080P" },
};

export class QueueFullError extends Error {}

function config() {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new Error("AGNES_API_KEY is missing in .env.local");
  const base = process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1";
  return { base, host: new URL(base).origin, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

/** Start a clip; returns Agnes's task id. A first-frame picture can be a data: URL. */
export async function submitClip(opts: { model: VideoModel; prompt: string; shape: "9:16" | "16:9"; seconds: number; firstFrame?: string | null }): Promise<string> {
  const { base, headers } = config();
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
    mode: opts.firstFrame ? "keyframe" : "text",
    size: VIDEO_MODELS[opts.model].size,
    aspect_ratio: opts.shape,
    seconds: String(Math.min(12, Math.max(4, Math.round(opts.seconds)))),
  };
  if (opts.firstFrame) body.first_frame = opts.firstFrame;
  const res = await fetch(`${base}/videos`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
  const data = (await res.json().catch(() => ({}))) as { video_id?: string; id?: string; code?: string; message?: string };
  if (data.code === "video_queue_full" || res.status === 429) throw new QueueFullError(data.message ?? "Agnes video queue is full");
  const id = data.video_id ?? data.id;
  if (!res.ok || !id) throw new Error(data.message ?? data.code ?? `Agnes video failed (${res.status})`);
  return id;
}

export type ClipStatus = { status: "pending" | "queued" | "in_progress" | "completed" | "failed"; progress: number; url: string | null; error: string | null };

export async function checkClip(id: string, model: VideoModel): Promise<ClipStatus | null> {
  const { host, headers } = config();
  const res = await fetch(`${host}/agnesapi?video_id=${encodeURIComponent(id)}&model_name=${model}`, { headers, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!res?.ok) return null;
  const p = (await res.json().catch(() => null)) as { status?: string; progress?: number; url?: string; error?: unknown } | null;
  if (!p?.status) return null;
  return {
    status: p.status as ClipStatus["status"],
    progress: p.progress ?? 0,
    url: p.url ?? null,
    error: p.error ? JSON.stringify(p.error).slice(0, 200) : null,
  };
}
