import "server-only";
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

/** Make sure every sound is in the video folder (preview and render read them there). */
export async function ensureAudioFiles(p: VideoProject): Promise<void> {
  const dir = videoDir(p.scriptId);
  for (const name of new Set(plannedSfx(p).map((s) => s.name))) await sfxFile(name, dir);
}

/** Sound effects for a freshly made video. */
export async function prepareAudio(scriptId: number): Promise<void> {
  const p = getProject(scriptId)!;
  setStep(scriptId, "sfx", "running", "Making sound effects");
  await ensureAudioFiles(p);
  const sounds = plannedSfx(p);
  setStep(scriptId, "sfx", "done", `${sounds.length} sounds: ${[...new Set(sounds.map((s) => s.name))].join(", ")}`);
}

/** Switch sound effects on or off. */
export async function setSfx(scriptId: number, enabled: boolean): Promise<VideoProject> {
  const p = getProject(scriptId);
  if (!p) throw new Error("Video not found");
  const next = { ...p, sfxEnabled: enabled };
  await ensureAudioFiles(next);
  const steps = next.steps.map((s) =>
    s.key === "sfx" ? { ...s, state: enabled ? ("done" as const) : ("skipped" as const), detail: enabled ? `${plannedSfx(next).length} sounds` : "Off" } : s,
  );
  return saveProject({ ...next, steps, editedAt: new Date().toISOString() });
}
