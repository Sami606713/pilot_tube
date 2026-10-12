import "server-only";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDb } from "@/lib/db";
import { mixMotionMusic } from "@/lib/music/short-music";
import type { ShortScript } from "@/lib/script/schema";
import { videoDir } from "@/lib/voice/voiceover";
import { buildMotionHtml } from "./composition";
import { planMotion, type TimedBeat } from "./plan";

const run = promisify(execFile);

/** The HyperFrames project; generated compositions go in a git-ignored subfolder of it. */
const CARDS_PROJECT = path.resolve(/*turbopackIgnore: true*/ "cards");
const GENERATED_DIR = path.join(CARDS_PROJECT, "compositions", "generated");

export type MotionGraphics = {
  scriptId: number;
  beats: TimedBeat[];
  duration: number;
  filePath: string;
  renderSeconds: number;
  createdAt: string;
};

type MotionRow = { script_id: number; plan: string; duration: number; file_path: string; render_seconds: number; created_at: string };

/** The motion graphics as rendered, before music; kept so the music can be swapped without re-rendering. */
export function silentMotionPath(finalPath: string): string {
  return finalPath.replace(/\.mp4$/, ".silent.mp4");
}

async function hyperframesPackage(): Promise<string> {
  const pkg = JSON.parse(await readFile(path.join(CARDS_PROJECT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  const pinned = pkg.scripts.render?.match(/hyperframes@[\w.-]+/)?.[0];
  if (!pinned) throw new Error("Could not find the pinned hyperframes version in cards/package.json");
  return pinned;
}

/** Script only: Agnes plans one animated screen per line, HyperFrames renders the whole thing to MP4. */
export async function createMotionGraphics(scriptId: number): Promise<MotionGraphics> {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM scripts WHERE id = ?`).get(scriptId) as { data: string } | undefined;
  if (!row) throw new Error(`Short #${scriptId} not found`);
  const script = JSON.parse(row.data) as ShortScript;

  const { beats, duration } = await planMotion(script);
  const html = buildMotionHtml(beats, duration, process.env.CARD_ACCENT || "#7CFF6B", process.env.CHANNEL_HANDLE || "");

  await mkdir(GENERATED_DIR, { recursive: true });
  const composition = path.join(GENERATED_DIR, `motion-${scriptId}.html`);
  await writeFile(composition, html);

  const outDir = path.join(videoDir(scriptId), "motion");
  await mkdir(outDir, { recursive: true });
  const finalPath = path.join(outDir, "motion.mp4");
  const tempPath = path.join(outDir, "motion.rendering.mp4");

  const started = Date.now();
  try {
    await run(
      "npx",
      ["--yes", await hyperframesPackage(), "render", "-c", path.relative(CARDS_PROJECT, composition), "--format", "mp4", "-o", tempPath, "--quiet"],
      { cwd: CARDS_PROJECT, timeout: 15 * 60_000, maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (err) {
    await rm(tempPath, { force: true });
    const e = err as { stderr?: string; stdout?: string; message: string };
    const detail = (e.stderr || e.stdout || e.message).replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-5).join(" ");
    throw new Error(`HyperFrames render failed: ${detail}`);
  }
  await rename(tempPath, silentMotionPath(finalPath));
  await mixMotionMusic(scriptId, silentMotionPath(finalPath), finalPath, duration);
  // The player cover is cached next to the video; drop it so it is remade from the new video.
  await rm(finalPath.replace(/\.mp4$/, ".poster.jpg"), { force: true });
  const renderSeconds = (Date.now() - started) / 1000;

  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO motion_graphics (script_id, plan, duration, file_path, render_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(scriptId, JSON.stringify(beats), duration, finalPath, renderSeconds, createdAt);
  return { scriptId, beats, duration, filePath: finalPath, renderSeconds, createdAt };
}

export function getMotionGraphics(scriptId: number): MotionGraphics | null {
  const row = getDb().prepare(`SELECT * FROM motion_graphics WHERE script_id = ?`).get(scriptId) as MotionRow | undefined;
  if (!row) return null;
  return {
    scriptId: row.script_id,
    beats: JSON.parse(row.plan) as TimedBeat[],
    duration: row.duration,
    filePath: row.file_path,
    renderSeconds: row.render_seconds,
    createdAt: row.created_at,
  };
}
