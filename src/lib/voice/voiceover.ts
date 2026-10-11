import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db";
import { fullNarration, type ShortScript } from "@/lib/script/schema";
import { alignWords, sceneTimings, type SceneTiming } from "./align";
import { synthesize, transcribe, type TimedWord } from "./deepgram";

const DEFAULT_VOICE = "aura-2-thalia-en";

export type Voiceover = {
  scriptId: number;
  voice: string;
  audioPath: string;
  duration: number;
  words: TimedWord[];
  scenes: SceneTiming[];
  createdAt: string;
};

type VoiceoverRow = {
  script_id: number;
  voice: string;
  audio_path: string;
  duration: number;
  words: string;
  scenes: string;
  created_at: string;
};

function fromRow(row: VoiceoverRow): Voiceover {
  return {
    scriptId: row.script_id,
    voice: row.voice,
    audioPath: row.audio_path,
    duration: row.duration,
    words: JSON.parse(row.words),
    scenes: JSON.parse(row.scenes),
    createdAt: row.created_at,
  };
}

/** Folder holding every file for one Short (voice now; clips and renders later). */
export function videoDir(scriptId: number): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "videos", String(scriptId));
}

export function getVoiceover(scriptId: number): Voiceover | null {
  const row = getDb().prepare(`SELECT * FROM voiceovers WHERE script_id = ?`).get(scriptId) as VoiceoverRow | undefined;
  return row ? fromRow(row) : null;
}

/** Script → MP3 (Aura-2) → word timings (Nova-3) → caption words + scene timings, saved to disk and DB. */
export async function createVoiceover(scriptId: number): Promise<Voiceover> {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM scripts WHERE id = ?`).get(scriptId) as { data: string } | undefined;
  if (!row) throw new Error(`Script #${scriptId} not found`);
  const script = JSON.parse(row.data) as ShortScript;

  const voice = process.env.DEEPGRAM_VOICE || DEFAULT_VOICE;
  const narration = fullNarration(script);
  const audio = await synthesize(narration, voice);
  const { duration, words: heard } = await transcribe(audio);
  if (heard.length === 0) throw new Error("Deepgram returned no words for the voiceover");

  const words = alignWords(narration, heard);
  const scenes = sceneTimings(
    script.scenes.map((s) => s.narration),
    words,
    duration,
  );

  const dir = videoDir(scriptId);
  await mkdir(dir, { recursive: true });
  const audioPath = path.join(dir, "voice.mp3");
  await writeFile(audioPath, audio);
  await writeFile(path.join(dir, "timings.json"), JSON.stringify({ duration, words, scenes }, null, 2));

  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO voiceovers (script_id, voice, audio_path, duration, words, scenes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(scriptId, voice, audioPath, duration, JSON.stringify(words), JSON.stringify(scenes), createdAt);
  db.prepare(`UPDATE scripts SET status = 'voiced' WHERE id = ?`).run(scriptId);

  return { scriptId, voice, audioPath, duration, words, scenes, createdAt };
}
