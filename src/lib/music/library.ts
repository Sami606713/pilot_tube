import "server-only";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getDb } from "@/lib/db";

const run = promisify(execFile);

/** Moods a track can have; the script's mood picks a matching track. */
export const MOODS = ["tense", "dramatic", "upbeat", "inspiring", "techy", "chill"] as const;
export type Mood = (typeof MOODS)[number];

/** YouTube Audio Library licenses: "standard" needs no credit; "cc" (Creative Commons) must be credited. */
export type License = "standard" | "cc";

export type Track = {
  id: number;
  title: string;
  artist: string | null;
  mood: Mood;
  license: License;
  attribution: string | null;
  filePath: string;
  duration: number;
  createdAt: string;
  usedBy: number;
};

type TrackRow = Omit<Track, "filePath" | "createdAt" | "usedBy"> & { file_path: string; created_at: string; used_by: number };

const MUSIC_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "music");
const ALLOWED = /\.(mp3|m4a|wav|ogg)$/i;
// Big enough for a few minutes of high-quality audio; Audio Library MP3s are ~3-8 MB.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const fromRow = (r: TrackRow): Track => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  mood: r.mood,
  license: r.license,
  attribution: r.attribution,
  filePath: r.file_path,
  duration: r.duration,
  createdAt: r.created_at,
  usedBy: r.used_by,
});

const SELECT = `SELECT t.*, (SELECT COUNT(*) FROM videos v WHERE json_extract(v.data, '$.music.trackId') = t.id) AS used_by FROM music_tracks t`;

export function listTracks(): Track[] {
  return (getDb().prepare(`${SELECT} ORDER BY t.mood, t.title`).all() as TrackRow[]).map(fromRow);
}

export function getTrack(id: number): Track | null {
  const row = getDb().prepare(`${SELECT} WHERE t.id = ?`).get(id) as TrackRow | undefined;
  return row ? fromRow(row) : null;
}

async function probeDuration(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { timeout: 30_000 });
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("That file is not a playable audio track");
  return seconds;
}

/** Save an uploaded track (e.g. an MP3 downloaded from the YouTube Audio Library). */
export async function addTrack(input: {
  file: File;
  title: string;
  artist: string | null;
  mood: Mood;
  license: License;
  attribution: string | null;
}): Promise<Track> {
  if (!ALLOWED.test(input.file.name)) throw new Error("Upload an MP3, M4A, WAV or OGG file");
  if (input.file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 25 MB");
  if (input.license === "cc" && !input.attribution?.trim()) {
    throw new Error("Creative Commons tracks need their credit text (copy it from the Audio Library)");
  }

  await mkdir(MUSIC_DIR, { recursive: true });
  const ext = path.extname(input.file.name).toLowerCase();
  const filePath = path.join(MUSIC_DIR, `track-${Date.now()}${ext}`);
  await writeFile(filePath, Buffer.from(await input.file.arrayBuffer()));

  let duration: number;
  try {
    duration = await probeDuration(filePath);
  } catch (err) {
    await rm(filePath, { force: true });
    throw err;
  }

  const { lastInsertRowid } = getDb()
    .prepare(`INSERT INTO music_tracks (title, artist, mood, license, attribution, file_path, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.title.trim(), input.artist?.trim() || null, input.mood, input.license, input.attribution?.trim() || null, filePath, duration, new Date().toISOString());
  return getTrack(Number(lastInsertRowid))!;
}

export async function updateTrackMood(id: number, mood: Mood): Promise<Track> {
  getDb().prepare(`UPDATE music_tracks SET mood = ? WHERE id = ?`).run(mood, id);
  const track = getTrack(id);
  if (!track) throw new Error(`Track #${id} not found`);
  return track;
}

/** Delete a track and its file. Videos using it lose their music (see clearMusic in the studio store). */
export async function deleteTrack(id: number): Promise<void> {
  const track = getTrack(id);
  if (!track) return;
  getDb().prepare(`DELETE FROM music_tracks WHERE id = ?`).run(id);
  await rm(track.filePath, { force: true });
}
