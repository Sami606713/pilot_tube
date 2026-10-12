/**
 * Input props for the Short composition. PilotTube builds these in src/lib/render/render.ts
 * (using the same timeline rules as the dashboard preview) and passes them with --props.
 * All media paths are relative to the --public-dir (the Short's data folder).
 */
export type ShortWord = { word: string; start: number; end: number };

export type ShortProps = {
  /** Total length in seconds (voiceover length). */
  duration: number;
  voice: string | null;
  accent: string;
  /** One visual per scene: an Agnes picture (moved with a slow zoom or pan) or, for older Shorts, a stock clip. */
  scenes: { start: number; end: number; media: { kind: "image" | "video"; src: string; duration: number | null } }[];
  captions: { start: number; end: number; words: ShortWord[] }[];
  cards: { kind: "hook" | "stat" | "outro"; src: string; start: number; end: number }[];
  /** Background music, ducked under the voice during `speech` ranges (seconds). */
  music?: { src: string; speech: { start: number; end: number }[] } | null;
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
