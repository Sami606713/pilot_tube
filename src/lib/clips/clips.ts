import "server-only";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDb } from "@/lib/db";
import { getThumbnail, thumbnailPath } from "@/lib/thumbnails/thumbnails";
import { checkClip, QueueFullError, submitClip, type VideoModel } from "./agnes-video";

const run = promisify(execFile);

export type ClipShape = "9:16" | "16:9";
export type ClipState = "waiting" | "making" | "done" | "failed";

export type Clip = {
  id: number;
  prompt: string;
  shape: ClipShape;
  seconds: number;
  model: VideoModel;
  /** First-frame picture (file in data/clips), for picture-to-video clips. */
  picture: string | null;
  state: ClipState;
  detail: string;
  progress: number;
  attempts: number;
  taskId: string | null;
  file: string | null;
  duration: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Keep asking a busy Agnes queue for this long before giving up. */
const MAX_WAIT_MS = 40 * 60_000;
const QUEUE_RETRY_MS = 30_000;
/** A run that hasn't reported for this long was cut off (dev server restart). */
const STALE_MS = 10 * 60_000;

export const CLIP_DIR = () => path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "clips");

function save(c: Clip): Clip {
  const next = { ...c, updatedAt: new Date().toISOString() };
  getDb().prepare(`UPDATE clips SET data = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(next), next.updatedAt, c.id);
  return next;
}

export function getClip(id: number): Clip | null {
  const row = getDb().prepare(`SELECT data FROM clips WHERE id = ?`).get(id) as { data: string } | undefined;
  if (!row) return null;
  const c = JSON.parse(row.data) as Clip;
  if ((c.state === "waiting" || c.state === "making") && Date.now() - Date.parse(c.updatedAt) > STALE_MS) {
    return save({ ...c, state: "failed", error: "Stopped (the server restarted). Press Retry." });
  }
  return c;
}

export function listClips(): Clip[] {
  const rows = getDb().prepare(`SELECT id FROM clips ORDER BY id DESC LIMIT 200`).all() as { id: number }[];
  return rows.map((r) => getClip(r.id)!).filter(Boolean);
}

export async function createClip(input: { prompt: string; shape: ClipShape; seconds: number; model: VideoModel; thumbnailId?: number | null; upload?: File | null }): Promise<Clip> {
  const now = new Date().toISOString();
  const { lastInsertRowid } = getDb().prepare(`INSERT INTO clips (data, updated_at) VALUES ('{}', ?)`).run(now);
  const id = Number(lastInsertRowid);
  await mkdir(CLIP_DIR(), { recursive: true });

  // Picture-to-video: keep a small copy of the first frame (sent inline to Agnes, it can't reach this computer).
  let picture: string | null = null;
  const source = input.upload ? Buffer.from(await input.upload.arrayBuffer()) : input.thumbnailId ? await readFile(thumbnailPath(getThumbnail(input.thumbnailId) ?? never())) : null;
  if (source) {
    const raw = path.join(CLIP_DIR(), `src-${id}.raw`);
    picture = `src-${id}.jpg`;
    await writeFile(raw, source);
    await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-vf", "scale='min(720,iw)':-2", "-q:v", "4", path.join(CLIP_DIR(), picture)], { timeout: 60_000 });
    await rm(raw, { force: true });
  }

  const clip: Clip = {
    id,
    prompt: input.prompt,
    shape: input.shape,
    seconds: Math.min(12, Math.max(4, Math.round(input.seconds))),
    model: input.model,
    picture,
    state: "waiting",
    detail: "Sending to Agnes",
    progress: 0,
    attempts: 0,
    taskId: null,
    file: null,
    duration: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  return save(clip);
}

function never(): never {
  throw new Error("Thumbnail not found");
}

/** Submit (retrying while the queue is full), wait for Agnes, download, make a poster. */
export async function runClip(id: number): Promise<void> {
  let c = getClip(id);
  if (!c) return;
  const started = Date.now();
  try {
    const firstFrame = c.picture ? `data:image/jpeg;base64,${(await readFile(path.join(CLIP_DIR(), c.picture))).toString("base64")}` : null;

    // 1. Get a spot in Agnes's queue.
    while (!c.taskId) {
      c = save({ ...c, attempts: c.attempts + 1, state: "waiting", detail: c.attempts ? `Agnes is busy, trying again (try ${c.attempts + 1})` : "Sending to Agnes" });
      try {
        c = save({ ...c, taskId: await submitClip({ model: c.model, prompt: c.prompt, shape: c.shape, seconds: c.seconds, firstFrame }), detail: "In Agnes's queue" });
      } catch (err) {
        if (!(err instanceof QueueFullError)) throw err;
        if (Date.now() - started > MAX_WAIT_MS) throw new Error("Agnes stayed busy for 40 minutes. Press Retry later.");
        await new Promise((r) => setTimeout(r, QUEUE_RETRY_MS));
      }
    }

    // 2. Wait while Agnes makes it (usually 2-6 minutes from the queue).
    for (;;) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await checkClip(c.taskId!, c.model);
      if (!s) {
        c = save(c); // keep the run marked alive
        continue;
      }
      if (s.status === "failed") throw new Error(`Agnes could not make it: ${s.error ?? "unknown error"}`);
      if (s.status === "completed" && s.url) {
        c = save({ ...c, state: "making", detail: "Downloading", progress: 100 });
        const file = `clip-${id}.mp4`;
        const res = await fetch(s.url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        await writeFile(path.join(CLIP_DIR(), file), Buffer.from(await res.arrayBuffer()));
        await run("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", path.join(CLIP_DIR(), file), "-frames:v", "1", "-q:v", "4", path.join(CLIP_DIR(), `clip-${id}.jpg`)], { timeout: 60_000 });
        const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(CLIP_DIR(), file)]);
        save({ ...c, state: "done", detail: "Ready", file, duration: Number(stdout.trim()) || c.seconds, error: null });
        return;
      }
      const making = s.status === "in_progress";
      c = save({ ...c, state: making ? "making" : "waiting", progress: s.progress, detail: making ? `Agnes is making it (${s.progress}%)` : "In Agnes's queue" });
    }
  } catch (err) {
    const fresh = getClip(id);
    if (fresh) save({ ...fresh, state: "failed", error: (err as Error).message.slice(0, 300) });
  }
}

/** Start again from scratch (a failed task can't be resumed). */
export function resetClip(id: number): Clip | null {
  const c = getClip(id);
  if (!c) return null;
  return save({ ...c, state: "waiting", detail: "Sending to Agnes", progress: 0, attempts: 0, taskId: null, error: null });
}

export async function deleteClip(id: number) {
  const c = getClip(id);
  getDb().prepare(`DELETE FROM clips WHERE id = ?`).run(id);
  if (!c) return;
  for (const f of [c.file, c.picture, c.file ? `clip-${id}.jpg` : null]) if (f) await rm(path.join(CLIP_DIR(), f), { force: true });
}
