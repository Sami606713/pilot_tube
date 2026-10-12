import "server-only";
import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { askJson } from "@/lib/agnes";
import { generateAgnesImage } from "@/lib/agnes-image";
import { getDb } from "@/lib/db";
import { getScript } from "@/lib/scripts/store";
import { getProject } from "@/lib/studio/store";
import { DEFAULT_ACCENT } from "@/lib/studio/types";

const run = promisify(execFile);

export type Shape = "9:16" | "16:9";
export const SHAPES: Record<Shape, { label: string; width: number; height: number; still: string }> = {
  "9:16": { label: "9:16 Short", width: 1080, height: 1920, still: "ThumbTall" },
  "16:9": { label: "16:9 YouTube", width: 1280, height: 720, still: "ThumbWide" },
};
const IDEAS = 3;

export type Thumbnail = {
  id: number;
  scriptId: number | null;
  title: string;
  shape: Shape;
  concept: string;
  prompt: string;
  headline: string | null;
  file: string;
  selected: boolean;
  createdAt: string;
};

type Row = { id: number; script_id: number | null; title: string; shape: Shape; concept: string; prompt: string; headline: string | null; file: string; selected: number; created_at: string };

const fromRow = (r: Row): Thumbnail => ({
  id: r.id,
  scriptId: r.script_id,
  title: r.title,
  shape: r.shape,
  concept: r.concept,
  prompt: r.prompt,
  headline: r.headline,
  file: r.file,
  selected: r.selected === 1,
  createdAt: r.created_at,
});

const THUMB_DIR = () => path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "thumbnails");

const ideasSchema = z.object({ ideas: z.array(z.object({ concept: z.string().min(3), prompt: z.string().min(20) })).min(IDEAS) });

const STYLE = `Each prompt describes ONE clear, sharp, eye-catching picture: one obvious main subject, filling the frame, dramatic cinematic lighting, high contrast, rich colors, clean uncluttered background, ultra detailed, professional photo or 3D render look.
Rules: no text, letters, numbers or logos in the image; no real people's faces (use objects, hands, silhouettes, robots, devices, buildings).`;

/** Agnes turns a video's story into 3 clearly different, clean picture ideas. */
async function ideasForVideo(title: string, story: string, shape: Shape) {
  const system = `You design YouTube thumbnails for a premium AI-news channel. The thumbnail must be a CLEAR picture of what the video is about, recognizable in one second.
Write ${IDEAS} clearly different ideas. ${STYLE}
Frame: ${shape === "9:16" ? "vertical 9:16, subject centered" : "wide 16:9, subject slightly right of center"}.
Return ONLY JSON: {"ideas":[{"concept":"3-6 word name","prompt":"the image prompt"}]}`;
  return (await askJson(system, `Video title: ${title}\nWhat the video says: ${story}`, (r) => ideasSchema.parse(r), { temperature: 0.9 })).ideas.slice(0, IDEAS);
}

/** Agnes keeps the user's idea and writes 3 variations of it (angle, lighting, composition). */
async function ideasForCustom(description: string, shape: Shape) {
  const system = `You turn a user's thumbnail idea into ${IDEAS} image prompts. Keep the user's subject and idea exactly; vary only the camera angle, lighting, colors and composition. ${STYLE}
Frame: ${shape === "9:16" ? "vertical 9:16" : "wide 16:9"}.
Return ONLY JSON: {"ideas":[{"concept":"3-6 word name","prompt":"the image prompt"}]}`;
  return (await askJson(system, `User's idea: ${description}`, (r) => ideasSchema.parse(r), { temperature: 0.8 })).ideas.slice(0, IDEAS);
}

/** Final image: exact size (center crop) with FFmpeg, or with the headline drawn by Remotion. */
async function finish(picture: string, out: string, shape: Shape, headline: string | null, accent: string) {
  const { width, height, still } = SHAPES[shape];
  if (!headline) {
    await run("ffmpeg", ["-v", "error", "-y", "-i", picture, "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`, "-q:v", "2", out], { timeout: 60_000 });
    return;
  }
  const props = { image: path.basename(picture), headline: headline.toUpperCase(), accent, shape };
  await run(
    path.join(process.cwd(), "node_modules/.bin/remotion"),
    ["still", "src/remotion/index.ts", still, out, `--props=${JSON.stringify(props)}`, `--public-dir=${path.dirname(picture)}`, "--image-format=jpeg", "--jpeg-quality=92", "--log=error"],
    { timeout: 3 * 60_000, maxBuffer: 20 * 1024 * 1024 },
  );
}

async function make(opts: { scriptId: number | null; title: string; shape: Shape; headline: string | null; accent: string; ideas: { concept: string; prompt: string }[] }) {
  const dir = THUMB_DIR();
  await mkdir(dir, { recursive: true });
  const stamp = Date.now();
  // All 3 at once: about 15-30s; free keys that hit the rate limit wait and retry.
  const settled = await Promise.allSettled(
    opts.ideas.map(async (idea, i) => {
      const picture = path.join(dir, `pic-${stamp}-${i + 1}.png`);
      const file = `thumb-${stamp}-${i + 1}.jpg`;
      await generateAgnesImage(idea.prompt, opts.shape, picture);
      await finish(picture, path.join(dir, file), opts.shape, opts.headline, opts.accent);
      await rm(picture, { force: true });
      return { ...idea, file };
    }),
  );
  const made = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  if (made.length === 0) {
    const reason = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")?.reason as Error | undefined;
    throw new Error(reason?.message ?? "No thumbnails could be made");
  }
  const insert = getDb().prepare(`INSERT INTO thumbnails (script_id, title, shape, concept, prompt, headline, file, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const createdAt = new Date().toISOString();
  for (const m of made) insert.run(opts.scriptId, opts.title, opts.shape, m.concept, m.prompt, opts.headline, m.file, createdAt);
  return { made: made.length, failed: settled.length - made.length };
}

/** 3 clean thumbnails for a video, from its script. */
export async function thumbnailsForVideo(scriptId: number, shape: Shape, headline: string | null) {
  const content = getScript(scriptId)?.content;
  if (!content) throw new Error("Script not found");
  const story = content.lines.map((l) => l.narration).join(" ");
  const accent = getProject(scriptId)?.accent ?? DEFAULT_ACCENT;
  return make({ scriptId, title: content.title, shape, headline, accent, ideas: await ideasForVideo(content.title, story, shape) });
}

/** 3 thumbnails from the user's own description. */
export async function customThumbnails(description: string, shape: Shape, headline: string | null) {
  return make({ scriptId: null, title: description.slice(0, 80), shape, headline, accent: DEFAULT_ACCENT, ideas: await ideasForCustom(description, shape) });
}

export function listThumbnails(): Thumbnail[] {
  return (getDb().prepare(`SELECT * FROM thumbnails ORDER BY id DESC LIMIT 200`).all() as Row[]).map(fromRow);
}

export function getThumbnail(id: number): Thumbnail | null {
  const row = getDb().prepare(`SELECT * FROM thumbnails WHERE id = ?`).get(id) as Row | undefined;
  return row ? fromRow(row) : null;
}

export const thumbnailPath = (t: Thumbnail) => path.join(THUMB_DIR(), t.file);

/** Mark one thumbnail as THE one for its video and shape (custom ones: just toggles). */
export function chooseThumbnail(id: number) {
  const t = getThumbnail(id);
  if (!t) throw new Error("Thumbnail not found");
  if (t.scriptId !== null) getDb().prepare(`UPDATE thumbnails SET selected = 0 WHERE script_id = ? AND shape = ?`).run(t.scriptId, t.shape);
  getDb().prepare(`UPDATE thumbnails SET selected = ? WHERE id = ?`).run(t.scriptId === null && t.selected ? 0 : 1, id);
}

export async function deleteThumbnail(id: number) {
  const t = getThumbnail(id);
  if (!t) return;
  getDb().prepare(`DELETE FROM thumbnails WHERE id = ?`).run(id);
  await rm(thumbnailPath(t), { force: true });
}
