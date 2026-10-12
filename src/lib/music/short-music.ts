import "server-only";
import { execFile } from "node:child_process";
import { access, copyFile, rename, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { agnes } from "@/lib/agnes";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import type { ShortScript } from "@/lib/script/schema";
import { getTrack, listTracks, MOODS, type Mood, type Track } from "./library";

const run = promisify(execFile);

export type ShortMusic = { track: Track | null; mood: Mood | null; chosen: boolean };

type Row = { track_id: number | null; mood: Mood | null };

export function getShortMusic(scriptId: number): ShortMusic {
  const row = getDb().prepare(`SELECT track_id, mood FROM short_music WHERE script_id = ?`).get(scriptId) as Row | undefined;
  if (!row) return { track: null, mood: null, chosen: false };
  return { track: row.track_id ? getTrack(row.track_id) : null, mood: row.mood, chosen: true };
}

function save(scriptId: number, trackId: number | null, mood: Mood | null) {
  getDb()
    .prepare(`INSERT OR REPLACE INTO short_music (script_id, track_id, mood, updated_at) VALUES (?, ?, ?, ?)`)
    .run(scriptId, trackId, mood, new Date().toISOString());
}

/** Agnes reads the script and names its mood from the fixed list (techy if unsure). */
async function detectMood(script: ShortScript): Promise<Mood> {
  const res = await agnes().chat.completions.create({
    model: env().AGNES_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: `Pick the background-music mood for this AI news Short. Answer with ONE word from: ${MOODS.join(", ")}.` },
      { role: "user", content: `${script.title}\n${script.scenes.map((s) => s.narration).join(" ")}` },
    ],
  });
  const word = (res.choices[0]?.message?.content ?? "").toLowerCase();
  return MOODS.find((m) => word.includes(m)) ?? "techy";
}

/** Prefer a track with the same mood, least used first, so Shorts don't all sound the same. */
function pickTrack(mood: Mood): Track | null {
  const tracks = listTracks();
  const byUse = (a: Track, b: Track) => a.usedBy - b.usedBy || a.id - b.id;
  return [...tracks.filter((t) => t.mood === mood)].sort(byUse)[0] ?? [...tracks].sort(byUse)[0] ?? null;
}

/** Read the script's mood and pick a matching track from the library. */
export async function autoPickMusic(scriptId: number): Promise<ShortMusic> {
  const row = getDb().prepare(`SELECT data FROM scripts WHERE id = ?`).get(scriptId) as { data: string } | undefined;
  if (!row) throw new Error(`Short #${scriptId} not found`);
  const mood = await detectMood(JSON.parse(row.data) as ShortScript);
  const track = pickTrack(mood);
  save(scriptId, track?.id ?? null, mood);
  await remixMotionMusic(scriptId);
  return getShortMusic(scriptId);
}

/** Choose a track by hand (null = no music). */
export async function setShortMusic(scriptId: number, trackId: number | null): Promise<ShortMusic> {
  if (trackId !== null && !getTrack(trackId)) throw new Error(`Track #${trackId} not found`);
  save(scriptId, trackId, getShortMusic(scriptId).mood);
  await remixMotionMusic(scriptId);
  return getShortMusic(scriptId);
}

/** Music-only bed for the motion graphics video: looped to length, faded in and out. */
const MOTION_MUSIC_VOLUME = 0.55;

/**
 * Put the Short's music under its (silent) motion graphics video. Video is copied untouched,
 * so this takes a second or two. Without music, the plain silent video is used.
 */
export async function mixMotionMusic(scriptId: number, silentPath: string, outPath: string, duration: number): Promise<void> {
  const { track } = getShortMusic(scriptId);
  if (!track) {
    await copyFile(silentPath, outPath);
    return;
  }
  const temp = outPath.replace(/\.mp4$/, ".mixing.mp4");
  const fadeOut = Math.max(duration - 2, 0);
  try {
    await run(
      "ffmpeg",
      [
        "-v", "error", "-y",
        "-i", silentPath,
        "-stream_loop", "-1", "-i", track.filePath,
        "-filter_complex", `[1:a]atrim=0:${duration},asetpts=N/SR/TB,volume=${MOTION_MUSIC_VOLUME},afade=t=in:d=1,afade=t=out:st=${fadeOut}:d=2[a]`,
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", temp,
      ],
      { timeout: 5 * 60_000 },
    );
    await rename(temp, outPath);
  } catch (err) {
    await rm(temp, { force: true });
    throw new Error(`Mixing music into the motion graphics failed: ${(err as Error).message}`);
  }
}

/** Re-mix the existing motion graphics video after the music changes (no re-render needed). */
export async function remixMotionMusic(scriptId: number): Promise<void> {
  // Imported lazily: render.ts imports this module too.
  const { getMotionGraphics, silentMotionPath } = await import("@/lib/motion/render");
  const motion = getMotionGraphics(scriptId);
  if (!motion) return;
  const silent = silentMotionPath(motion.filePath);
  // Videos made before music existed are silent themselves, so they become the master.
  await access(silent).catch(() => copyFile(motion.filePath, silent));
  await mixMotionMusic(scriptId, silent, motion.filePath, motion.duration);
  getDb().prepare(`UPDATE motion_graphics SET created_at = ? WHERE script_id = ?`).run(new Date().toISOString(), scriptId);
}
