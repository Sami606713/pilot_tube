import "server-only";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { askJson } from "@/lib/agnes";
import { getTrack, listTracks, MOODS, type Mood, type Track } from "@/lib/music/library";
import { SFX_LEAD, SFX_VOLUME, sfxFile, sfxFromCue, TRANSITION_SFX, type Sfx } from "./sfx";
import { getProject, saveProject, setStep, videoDir } from "./store";
import type { ShortProps, VideoProject } from "./types";

/** One sound per cut: the script's cue, else the transition's natural sound. Never two within 0.7s. */
export function plannedSfx(p: VideoProject): { name: Sfx; at: number; volume: number }[] {
  if (!p.sfxEnabled) return [];
  const out: { name: Sfx; at: number; volume: number }[] = [];
  p.lines.forEach((l, i) => {
    const name = sfxFromCue(l.sfx) ?? (i > 0 ? TRANSITION_SFX[p.lines[i - 1].transition] : null);
    if (!name) return;
    const at = Math.max(0, l.start - (SFX_LEAD[name] ?? 0));
    if (out.some((s) => Math.abs(s.at - at) < 0.7)) return;
    out.push({ name, at, volume: SFX_VOLUME[name] });
  });
  return out;
}

export function sfxProps(p: VideoProject): ShortProps["sfx"] {
  return plannedSfx(p).map((s) => ({ file: `sfx-${s.name}.wav`, at: s.at, volume: s.volume }));
}

/** Make sure every sound and the music file are in the video folder (preview and render read them there). */
export async function ensureAudioFiles(p: VideoProject): Promise<void> {
  const dir = videoDir(p.scriptId);
  for (const name of new Set(plannedSfx(p).map((s) => s.name))) await sfxFile(name, dir);
  if (p.music) {
    const track = getTrack(p.music.trackId);
    if (track) await copyFile(track.filePath, path.join(dir, p.music.file));
  }
}

const MOOD_PROMPT = `Pick the background-music mood for this dramatic AI-news Short. Answer ONLY JSON: { "mood": one of ${MOODS.map((m) => `"${m}"`).join(", ")} }`;

async function detectMood(p: VideoProject): Promise<Mood> {
  const text = `${p.title}\n${p.lines.map((l) => l.narration).join(" ")}`;
  try {
    const { mood } = await askJson(MOOD_PROMPT, text, (raw) => z.object({ mood: z.enum(MOODS) }).parse(raw), { temperature: 0 });
    return mood;
  } catch {
    return "techy";
  }
}

/** Least-used track with the mood (so Shorts don't all sound the same), else any track. */
function pickTrack(mood: Mood): Track | null {
  const tracks = listTracks();
  const byUse = (a: Track, b: Track) => a.usedBy - b.usedBy || a.id - b.id;
  return [...tracks.filter((t) => t.mood === mood)].sort(byUse)[0] ?? [...tracks].sort(byUse)[0] ?? null;
}

function musicFor(track: Track): NonNullable<VideoProject["music"]> {
  return { trackId: track.id, title: track.title, file: `music-${track.id}${path.extname(track.filePath).toLowerCase()}`, mood: track.mood, attribution: track.license === "cc" ? track.attribution : null };
}

/** Sound effects + music for a freshly made video (music picked by the script's mood). */
export async function prepareAudio(scriptId: number): Promise<void> {
  let p = getProject(scriptId)!;
  setStep(scriptId, "sfx", "running", "Making sound effects");
  await ensureAudioFiles({ ...p, music: null });
  const sounds = plannedSfx(p);
  setStep(scriptId, "sfx", "done", `${sounds.length} sounds: ${[...new Set(sounds.map((s) => s.name))].join(", ")}`);

  setStep(scriptId, "music", "running", "Reading the mood");
  const mood = await detectMood(p);
  const track = pickTrack(mood);
  p = getProject(scriptId)!;
  if (!track) {
    saveProject({ ...p, mood, music: null });
    setStep(scriptId, "music", "skipped", `Mood: ${mood}. Your Music library is empty: add tracks on the Music page.`);
    return;
  }
  const next = saveProject({ ...p, mood, music: musicFor(track) });
  await ensureAudioFiles(next);
  setStep(scriptId, "music", "done", `"${track.title}" (${track.mood}${track.mood === mood ? "" : `, no ${mood} track yet`})`);
}

/** Change the music (a track id, "auto" by mood, or null for none) and/or switch sound effects. */
export async function setAudio(scriptId: number, change: { music?: number | "auto" | null; sfx?: boolean }): Promise<VideoProject> {
  let p = getProject(scriptId);
  if (!p) throw new Error("Video not found");
  if (change.sfx !== undefined) p = { ...p, sfxEnabled: change.sfx };
  if (change.music !== undefined) {
    if (change.music === null) p = { ...p, music: null };
    else {
      const mood = (p.mood as Mood | null) ?? (await detectMood(p));
      const track = change.music === "auto" ? pickTrack(mood) : getTrack(change.music);
      if (!track) throw new Error(change.music === "auto" ? "Your Music library is empty: add tracks on the Music page." : "Track not found");
      p = { ...p, mood, music: musicFor(track) };
    }
  }
  await ensureAudioFiles(p);
  const steps = p.steps.map((s) =>
    s.key === "music"
      ? { ...s, state: p!.music ? ("done" as const) : ("skipped" as const), detail: p!.music ? `"${p!.music.title}" (${p!.music.mood})` : "No music" }
      : s.key === "sfx"
        ? { ...s, state: p!.sfxEnabled ? ("done" as const) : ("skipped" as const), detail: p!.sfxEnabled ? `${plannedSfx(p!).length} sounds` : "Off" }
        : s,
  );
  return saveProject({ ...p, steps, editedAt: new Date().toISOString() });
}
