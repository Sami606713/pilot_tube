/** Shapes shared by the Video studio engine (server), the Remotion composition and the studio page. */

import type { Part, Transition, VisualType } from "@/lib/scripts/types";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Deepgram Aura-2 "Zeus": masculine, deep, smooth. */
export const VOICE = "aura-2-zeus-en";
/** Accent when the story has no company with usable brand colors. */
export const DEFAULT_ACCENT = "#FF3B30";

/** How a line is shown. */
export type LineMode = "footage" | "ai-clip" | "3d" | "logo" | "chart" | "text";
export const MODES: Record<LineMode, string> = {
  footage: "Stock footage",
  "ai-clip": "AI clip",
  "3d": "3D graphic",
  logo: "Logo",
  chart: "Chart",
  text: "Kinetic text",
};

/** Ready-made 3D scenes (Three.js), animated from the frame number so renders are exact. */
export type Scene3D = "chip" | "servers" | "network" | "globe" | "particles" | "core";
export const SCENES: Record<Scene3D, string> = {
  chip: "Glowing chip",
  servers: "Server corridor",
  network: "Neural network",
  globe: "Data globe",
  particles: "Data stream",
  core: "AI core",
};

export type Chart =
  | { kind: "counter"; value: number; decimals: number; prefix: string; suffix: string; label: string }
  | { kind: "bars"; items: { label: string; value: number }[]; suffix: string; label: string };

export type LogoAsset = { domain: string; name: string; file: string | null; color: string };

export type LineDesign = { scene: Scene3D; chart: Chart | null; phrases: string[]; logo: LogoAsset | null };

export type TimedWord = { word: string; start: number; end: number };

/** One stock clip that could fill a line. */
export type ClipOption = {
  pexelsId: number;
  pageUrl: string;
  author: string;
  authorUrl: string;
  /** Pexels thumbnail (remote) for the picker. */
  poster: string;
  /** Remote MP4 (portrait, ~1080 wide) to download when chosen. */
  fileUrl: string;
  width: number;
  height: number;
  duration: number;
};

export type StudioLine = {
  index: number;
  part: Part;
  narration: string;
  /** What the script asked for; part 1 fills every line with B-roll. */
  plannedVisual: VisualType;
  visualDescription: string;
  onScreenText: string;
  transition: Transition;
  sfx: string;
  start: number;
  end: number;
  query: string;
  options: ClipOption[];
  /** Chosen option's Pexels id and its downloaded file (relative to the video folder). */
  chosen: number | null;
  file: string | null;
  mode: LineMode;
  design: LineDesign;
  /** Agnes AI clip for this line, when one was generated. */
  aiClip: { file: string; duration: number } | null;
};

export type StudioStepKey = "voice" | "visuals" | "sfx" | "music" | "render";
export type StudioStep = { key: StudioStepKey; label: string; state: "waiting" | "running" | "done" | "skipped" | "failed"; detail?: string };

export const STUDIO_STEP_LABELS: Record<StudioStepKey, string> = {
  voice: "Voice and word timings",
  visuals: "Designing visuals for every line",
  sfx: "Sound effects on every cut",
  music: "Background music",
  render: "Render final video",
};

export type RenderInfo = { file: string; duration: number; sizeBytes: number; seconds: number; createdAt: string };

export type VideoProject = {
  scriptId: number;
  title: string;
  status: "running" | "ready" | "rendering" | "failed";
  steps: StudioStep[];
  accent: string;
  /** Main company of the story (accent color source). */
  brand: { name: string; domain: string } | null;
  /** Background music from the Music library (null = none). */
  music: { trackId: number; title: string; file: string; mood: string; attribution: string | null } | null;
  /** Detected mood of the script, used to pick music. */
  mood: string | null;
  sfxEnabled: boolean;
  voice: { file: string; duration: number; words: TimedWord[] } | null;
  lines: StudioLine[];
  render: RenderInfo | null;
  /** Last change to voice or visuals; newer than render.createdAt = the render is out of date. */
  editedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Everything the Remotion composition needs; `assets` resolves file names to URLs (preview) or static files (render). */
export type ShortProps = {
  duration: number;
  accent: string;
  voice: string;
  words: TimedWord[];
  lines: {
    start: number;
    end: number;
    mode: LineMode;
    clip: string | null;
    clipDuration: number;
    onScreenText: string;
    part: Part;
    transition: Transition;
    design: LineDesign;
  }[];
  /** "static" = files are in the render's public dir; otherwise a URL prefix like /api/studio/3/file. */
  assets: string;
  music: string | null;
  /** Sound effects: file, start time (s), volume 0-1. */
  sfx: { file: string; at: number; volume: number }[];
};
