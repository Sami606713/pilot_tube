import "server-only";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Transition } from "@/lib/scripts/types";

const run = promisify(execFile);

/**
 * Sound effects made with FFmpeg's synthesizers (no library, no license to track).
 * Generated once into data/sfx and copied into each video's folder.
 */
export type Sfx = "impact" | "whoosh" | "riser" | "glitch" | "click" | "chime" | "rumble" | "shimmer";

const RECIPES: Record<Sfx, string[]> = {
  // Deep sub drop + short noise crack, with a little room.
  impact: [
    "-f", "lavfi", "-i", "aevalsrc=0.95*sin(2*PI*(45+110*exp(-t*16))*t)*exp(-t*4.5):s=48000:d=1.4",
    "-f", "lavfi", "-i", "anoisesrc=color=white:d=0.18:a=0.6",
    "-filter_complex", "[1]lowpass=f=2200,afade=t=out:st=0:d=0.18[n];[0][n]amix=inputs=2:weights=1 0.6:normalize=0,aecho=0.8:0.5:60:0.25,alimiter=limit=0.95",
  ],
  // Pink noise swelling and fading through a band-pass: air moving past.
  whoosh: [
    "-f", "lavfi", "-i", "anoisesrc=color=pink:d=0.75:a=0.9",
    "-af", "highpass=f=350,lowpass=f=5000,afade=t=in:st=0:d=0.38,afade=t=out:st=0.38:d=0.37,aphaser=type=t:speed=2,volume=1.6",
  ],
  // Rising tone + noise that builds to the cut.
  riser: [
    "-f", "lavfi", "-i", "aevalsrc=0.35*sin(2*PI*(180+520*t*t)*t):s=48000:d=1.3",
    "-f", "lavfi", "-i", "anoisesrc=color=white:d=1.3:a=0.25",
    "-filter_complex", "[1]highpass=f=1500[n];[0][n]amix=inputs=2:normalize=0,afade=t=in:st=0:d=1.25,alimiter=limit=0.9",
  ],
  // Bit-crushed, stuttering digital noise.
  glitch: [
    "-f", "lavfi", "-i", "anoisesrc=color=white:d=0.4:a=0.7",
    "-af", "acrusher=bits=4:samples=30:mode=log,tremolo=f=28:d=0.95,highpass=f=300,afade=t=out:st=0.3:d=0.1,volume=0.9",
  ],
  // Short bright tick.
  click: ["-f", "lavfi", "-i", "aevalsrc=0.8*sin(2*PI*2200*t)*exp(-t*90)+0.4*sin(2*PI*900*t)*exp(-t*60):s=48000:d=0.1"],
  // Two bell partials with a soft echo.
  chime: ["-f", "lavfi", "-i", "aevalsrc=0.5*sin(2*PI*1318*t)*exp(-t*3.5)+0.3*sin(2*PI*1975*t)*exp(-t*5):s=48000:d=1.6", "-af", "aecho=0.8:0.6:120:0.3"],
  // Low brown-noise swell.
  rumble: ["-f", "lavfi", "-i", "anoisesrc=color=brown:d=1.3:a=0.9", "-af", "lowpass=f=160,afade=t=in:st=0:d=0.35,afade=t=out:st=0.6:d=0.7,volume=2.2"],
  // Airy high sparkle for light leaks.
  shimmer: [
    "-f", "lavfi", "-i", "aevalsrc=0.18*sin(2*PI*2637*t)+0.14*sin(2*PI*3520*t)+0.1*sin(2*PI*4186*t):s=48000:d=1.1",
    "-af", "tremolo=f=11:d=0.6,afade=t=in:st=0:d=0.25,afade=t=out:st=0.4:d=0.7,aecho=0.8:0.7:90:0.35",
  ],
};

const SFX_DIR = () => path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "sfx");

/** How loud each sound sits under the voice. */
export const SFX_VOLUME: Record<Sfx, number> = { impact: 0.5, whoosh: 0.38, riser: 0.28, glitch: 0.3, click: 0.35, chime: 0.25, rumble: 0.4, shimmer: 0.22 };

/** The riser builds INTO the cut; everything else starts on it. */
export const SFX_LEAD: Partial<Record<Sfx, number>> = { riser: 1.25, whoosh: 0.32 };

async function ensureSfx(name: Sfx): Promise<string> {
  const dir = SFX_DIR();
  const file = path.join(dir, `${name}.wav`);
  try {
    await access(file);
    return file;
  } catch {
    await mkdir(dir, { recursive: true });
    const raw = path.join(dir, `${name}.raw.wav`);
    const tmp = path.join(dir, `${name}.tmp.wav`);
    await run("ffmpeg", ["-v", "error", "-y", ...RECIPES[name], "-ac", "2", "-ar", "48000", raw], { timeout: 60_000 });
    // Same peak (-3 dB) for every sound, so SFX_VOLUME alone sets how loud each one sits in the mix.
    const { stderr } = await run("ffmpeg", ["-i", raw, "-af", "volumedetect", "-f", "null", "-"], { timeout: 60_000 });
    const peak = Number(stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -3);
    await run("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `volume=${(-3 - peak).toFixed(1)}dB`, tmp], { timeout: 60_000 });
    await rm(raw, { force: true });
    await rename(tmp, file);
    return file;
  }
}

/** Copy a sound into a video folder; returns its file name there. */
export async function sfxFile(name: Sfx, videoFolder: string): Promise<string> {
  const target = `sfx-${name}.wav`;
  await copyFile(await ensureSfx(name), path.join(videoFolder, target));
  return target;
}

/** The script's free-text cue ("deep impact", "glitch hit") → one of our sounds. */
export function sfxFromCue(cue: string): Sfx | null {
  const c = cue.toLowerCase();
  if (!c.trim()) return null;
  if (/glitch|static|digital|data|error/.test(c)) return "glitch";
  if (/rise|riser|build|swell|tension/.test(c)) return "riser";
  if (/impact|boom|hit|slam|thud|punch|bass|drop/.test(c)) return "impact";
  if (/whoosh|swoosh|swish|sweep|wind|air/.test(c)) return "whoosh";
  if (/click|tick|snap|clank|mechanical|type|key/.test(c)) return "click";
  if (/chime|ping|ding|bell|sparkle/.test(c)) return "chime";
  if (/hum|rumble|buzz|drone|low/.test(c)) return "rumble";
  if (/shimmer|shine|glow|light/.test(c)) return "shimmer";
  return "whoosh";
}

/** Sound that fits a transition when the script gave no cue. */
export const TRANSITION_SFX: Record<Transition, Sfx | null> = {
  cut: null,
  "zoom-punch": "impact",
  "whip-pan": "whoosh",
  glitch: "glitch",
  "light-leak": "shimmer",
  "3d-flip": "whoosh",
  "blur-slide": "whoosh",
};
