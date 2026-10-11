import "server-only";
import { execFile } from "node:child_process";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ShortProps } from "@/remotion/types";
import { getCards } from "@/lib/cards/render";
import { getDb } from "@/lib/db";
import { getClips } from "@/lib/footage/clips";
import { captionPages, cardSchedule } from "@/lib/timeline";
import { getVoiceover, videoDir } from "@/lib/voice/voiceover";

const run = promisify(execFile);

/** Project root. Remotion lives in src/remotion, the layout of Remotion's official Next.js template. */
const PROJECT_ROOT = path.resolve(/*turbopackIgnore: true*/ ".");
const RENDERS_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "renders");

export type RenderResult = {
  scriptId: number;
  filePath: string;
  duration: number;
  sizeBytes: number;
  renderSeconds: number;
  createdAt: string;
};

type RenderRow = { script_id: number; file_path: string; duration: number; size_bytes: number; render_seconds: number; created_at: string };

/**
 * Turn a Short's saved parts into Remotion props. Uses the same caption and card timing
 * as the dashboard preview (src/lib/timeline.ts), so the render matches what you previewed.
 */
export function buildProps(scriptId: number): ShortProps {
  const voiceover = getVoiceover(scriptId);
  if (!voiceover) throw new Error("Make the voice first: the video's length and captions come from it");
  const clips = getClips(scriptId);
  if (clips.length < voiceover.scenes.length) throw new Error("Find clips first: every scene needs a clip");

  const dir = videoDir(scriptId);
  const relative = (file: string) => path.relative(dir, file).split(path.sep).join("/");
  const cards = getCards(scriptId);
  const slots = cardSchedule(cards, voiceover.scenes, voiceover.duration);

  return {
    duration: voiceover.duration,
    voice: relative(voiceover.audioPath),
    accent: process.env.CARD_ACCENT || "#7CFF6B",
    scenes: voiceover.scenes.map((scene, i) => {
      const clip = clips.find((c) => c.sceneIndex === i)!;
      return { start: scene.start, end: scene.end, clip: relative(clip.filePath), clipDuration: clip.duration };
    }),
    captions: captionPages(voiceover.words),
    cards: slots.map((slot) => ({
      kind: slot.kind,
      src: relative(cards.find((c) => c.name === slot.name)!.filePath),
      start: slot.start,
      end: slot.end,
    })),
  };
}

/** Render the final 1080x1920 MP4 with Remotion and record it. */
export async function renderShort(scriptId: number): Promise<RenderResult> {
  const props = buildProps(scriptId);
  await mkdir(RENDERS_DIR, { recursive: true });

  const propsFile = path.join(RENDERS_DIR, `${scriptId}.props.json`);
  const finalPath = path.join(RENDERS_DIR, `${scriptId}.mp4`);
  // Render to a temp name so a failed render never replaces a good one.
  const tempPath = path.join(RENDERS_DIR, `${scriptId}.rendering.mp4`);
  await writeFile(propsFile, JSON.stringify(props));

  const started = Date.now();
  try {
    await run(
      path.join(PROJECT_ROOT, "node_modules", ".bin", "remotion"),
      [
        "render",
        "src/remotion/index.ts",
        "Short",
        tempPath,
        `--props=${propsFile}`,
        // The Short's own folder becomes Remotion's public dir, so staticFile("clips/...") resolves.
        `--public-dir=${videoDir(scriptId)}`,
        "--codec=h264",
        "--crf=20",
        "--log=error",
      ],
      { cwd: PROJECT_ROOT, timeout: 20 * 60_000, maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (err) {
    await rm(tempPath, { force: true });
    const e = err as { stderr?: string; stdout?: string; message: string };
    const detail = (e.stderr || e.stdout || e.message).replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-6).join(" ");
    throw new Error(`Remotion render failed: ${detail}`);
  }

  // Remotion mixes the voice at about -23 LUFS; Shorts play best around -14 LUFS on phones.
  // Normalize the audio only and copy the video stream untouched (takes about a second).
  const loudPath = path.join(RENDERS_DIR, `${scriptId}.loud.mp4`);
  try {
    await run("ffmpeg", ["-v", "error", "-y", "-i", tempPath, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", loudPath], {
      timeout: 5 * 60_000,
    });
    await rename(loudPath, tempPath);
  } catch (err) {
    await rm(loudPath, { force: true });
    await rm(tempPath, { force: true });
    throw new Error(`Audio loudness pass failed: ${(err as Error).message}`);
  }
  const renderSeconds = (Date.now() - started) / 1000;

  await rename(tempPath, finalPath);
  await rm(propsFile, { force: true });
  const { size } = await stat(finalPath);

  const result: RenderResult = {
    scriptId,
    filePath: finalPath,
    duration: props.duration,
    sizeBytes: size,
    renderSeconds,
    createdAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO renders (script_id, file_path, duration, size_bytes, render_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(scriptId, finalPath, result.duration, size, renderSeconds, result.createdAt);
  getDb().prepare(`UPDATE scripts SET status = 'rendered' WHERE id = ?`).run(scriptId);
  return result;
}

export function getRender(scriptId: number): RenderResult | null {
  const row = getDb().prepare(`SELECT * FROM renders WHERE script_id = ?`).get(scriptId) as RenderRow | undefined;
  if (!row) return null;
  return {
    scriptId: row.script_id,
    filePath: row.file_path,
    duration: row.duration,
    sizeBytes: row.size_bytes,
    renderSeconds: row.render_seconds,
    createdAt: row.created_at,
  };
}
