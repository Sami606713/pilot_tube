import "server-only";
import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { agnes } from "@/lib/agnes";
import { generateAgnesImage } from "@/lib/agnes-image";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import type { ShortScript } from "@/lib/script/schema";
import { videoDir } from "@/lib/voice/voiceover";
import type { ThumbnailProps } from "@/remotion/Thumbnail";

const run = promisify(execFile);
const PROJECT_ROOT = path.resolve(/*turbopackIgnore: true*/ ".");

export const FORMATS = {
  short: { ratio: "9:16", composition: "ThumbnailShort", label: "9:16 Short" },
  wide: { ratio: "16:9", composition: "ThumbnailWide", label: "16:9 YouTube" },
} as const;
export type ThumbnailFormat = keyof typeof FORMATS;

const OPTIONS_PER_RUN = 3;

export type Thumbnail = {
  id: number;
  scriptId: number;
  format: ThumbnailFormat;
  concept: string;
  prompt: string;
  headline: string;
  filePath: string;
  selected: boolean;
  createdAt: string;
};

type ThumbnailRow = {
  id: number;
  script_id: number;
  format: ThumbnailFormat;
  concept: string;
  prompt: string;
  headline: string;
  background_path: string;
  file_path: string;
  selected: number;
  created_at: string;
};

const fromRow = (r: ThumbnailRow): Thumbnail => ({
  id: r.id,
  scriptId: r.script_id,
  format: r.format,
  concept: r.concept,
  prompt: r.prompt,
  headline: r.headline,
  filePath: r.file_path,
  selected: r.selected === 1,
  createdAt: r.created_at,
});

const conceptsSchema = z.object({
  concepts: z
    .array(z.object({ concept: z.string().min(3), prompt: z.string().min(20) }))
    .min(OPTIONS_PER_RUN),
});

/** Agnes (text) turns the story into distinct picture ideas, so the options really differ. */
async function pictureConcepts(script: ShortScript, storyTitle: string, format: ThumbnailFormat): Promise<{ concept: string; prompt: string }[]> {
  const res = await agnes().chat.completions.create({
    model: env().AGNES_MODEL,
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content: `You design YouTube thumbnail backgrounds for an AI news channel.
Write ${OPTIONS_PER_RUN} clearly different picture ideas for the story. Each prompt describes ONE striking, cinematic image:
a clear subject, dramatic lighting, high contrast, bold colors, simple uncluttered background.
${format === "short" ? "Vertical 9:16 frame: keep the top third calm and darker (a headline goes there); main subject in the middle and lower part." : "Wide 16:9 frame: keep the left half calm and darker (a headline goes there); main subject on the right."}
Rules: no text, no letters, no words, no numbers, no logos, no watermarks, no real people's faces (use silhouettes, robots, objects or hands instead).
Reply with ONLY JSON: {"concepts":[{"concept":"3-6 word name","prompt":"the image prompt"}]}`,
      },
      { role: "user", content: `Headline: ${script.cards.hook}\nTitle: ${script.title}\nStory: ${storyTitle}\nSummary: ${script.description}` },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return conceptsSchema.parse(JSON.parse(json)).concepts.slice(0, OPTIONS_PER_RUN);
}

/** Put the real headline on the picture with Remotion (crisp text, brand style). */
async function renderStill(dir: string, background: string, headline: string, format: ThumbnailFormat, outPath: string): Promise<void> {
  const props: ThumbnailProps = { background, headline, kicker: "AI NEWS", accent: process.env.CARD_ACCENT || "#7CFF6B", format };
  try {
    await run(
      path.join(PROJECT_ROOT, "node_modules", ".bin", "remotion"),
      ["still", "src/remotion/index.ts", FORMATS[format].composition, outPath, `--props=${JSON.stringify(props)}`, `--public-dir=${dir}`, "--image-format=jpeg", "--jpeg-quality=90", "--log=error"],
      { cwd: PROJECT_ROOT, timeout: 3 * 60_000, maxBuffer: 20 * 1024 * 1024 },
    );
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new Error(`Thumbnail render failed: ${(e.stderr || e.message).trim().split("\n").slice(-3).join(" ")}`);
  }
}

/** Make 3 thumbnail options for a Short in one format. Pictures are made in parallel (about 15s). */
export async function createThumbnails(scriptId: number, format: ThumbnailFormat): Promise<Thumbnail[]> {
  const db = getDb();
  const row = db
    .prepare(`SELECT sc.data, st.title AS story_title FROM scripts sc JOIN stories st ON st.id = sc.story_id WHERE sc.id = ?`)
    .get(scriptId) as { data: string; story_title: string } | undefined;
  if (!row) throw new Error(`Short #${scriptId} not found`);
  const script = JSON.parse(row.data) as ShortScript;

  const dir = path.join(videoDir(scriptId), "thumbnails");
  await mkdir(dir, { recursive: true });
  const concepts = await pictureConcepts(script, row.story_title, format);
  const stamp = Date.now();

  const settled = await Promise.allSettled(
    concepts.map(async (c, i) => {
      const background = `bg-${format}-${stamp}-${i + 1}.png`;
      const file = `thumb-${format}-${stamp}-${i + 1}.jpg`;
      await generateAgnesImage(c.prompt, FORMATS[format].ratio, path.join(dir, background));
      await renderStill(dir, background, script.cards.hook, format, path.join(dir, file));
      return { ...c, background: path.join(dir, background), file: path.join(dir, file) };
    }),
  );
  const made = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  if (made.length === 0) {
    const reason = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")?.reason as Error | undefined;
    throw new Error(reason?.message ?? "No thumbnails could be made");
  }

  const insert = db.prepare(
    `INSERT INTO thumbnails (script_id, format, concept, prompt, headline, background_path, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = new Date().toISOString();
  for (const m of made) insert.run(scriptId, format, m.concept, m.prompt, script.cards.hook, m.background, m.file, createdAt);
  return listThumbnails(scriptId).filter((t) => t.createdAt === createdAt);
}

export function listThumbnails(scriptId: number): Thumbnail[] {
  return (getDb().prepare(`SELECT * FROM thumbnails WHERE script_id = ? ORDER BY id DESC`).all(scriptId) as ThumbnailRow[]).map(fromRow);
}

export function getThumbnail(id: number): Thumbnail | null {
  const row = getDb().prepare(`SELECT * FROM thumbnails WHERE id = ?`).get(id) as ThumbnailRow | undefined;
  return row ? fromRow(row) : null;
}

/** Mark one thumbnail as the chosen one for its Short and format. */
export function selectThumbnail(id: number): Thumbnail {
  const thumb = getThumbnail(id);
  if (!thumb) throw new Error(`Thumbnail #${id} not found`);
  const db = getDb();
  db.prepare(`UPDATE thumbnails SET selected = 0 WHERE script_id = ? AND format = ?`).run(thumb.scriptId, thumb.format);
  db.prepare(`UPDATE thumbnails SET selected = 1 WHERE id = ?`).run(id);
  return { ...thumb, selected: true };
}

export async function deleteThumbnail(id: number): Promise<void> {
  const row = getDb().prepare(`SELECT * FROM thumbnails WHERE id = ?`).get(id) as ThumbnailRow | undefined;
  if (!row) return;
  await rm(row.file_path, { force: true });
  await rm(row.background_path, { force: true });
  getDb().prepare(`DELETE FROM thumbnails WHERE id = ?`).run(id);
}
