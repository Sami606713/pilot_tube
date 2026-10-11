/**
 * Input props for the Short composition. PilotTube builds these in src/lib/render/props.ts
 * (using the same timeline rules as the dashboard preview) and passes them with --props.
 * All media paths are relative to the --public-dir (the Short's data folder).
 */
export type ShortWord = { word: string; start: number; end: number };

export type ShortProps = {
  /** Total length in seconds (voiceover length). */
  duration: number;
  voice: string | null;
  accent: string;
  scenes: { start: number; end: number; clip: string; clipDuration: number }[];
  captions: { start: number; end: number; words: ShortWord[] }[];
  cards: { kind: "hook" | "stat" | "outro"; src: string; start: number; end: number }[];
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
