/** Shapes shared by the script engine (server) and the Scripts pages (client). */

import type { Step as ResearchStep } from "@/lib/research/types";

export type ScriptStatus = "running" | "done" | "failed";

/** Narration pace of a dramatic voice-over (words per second): 125-138 words ≈ 52-58s. */
export const WORDS_PER_SECOND = 2.4;
export const WORD_TARGET = { min: 125, max: 138 } as const;
/** Accepted after rewrites: never over ~58.5s. */
export const WORD_LIMIT = { min: 118, max: 140 } as const;

export type Part = "hook" | "setup" | "tension" | "reveal" | "why" | "loop";
export const PARTS: Record<Part, string> = {
  hook: "Hook",
  setup: "Setup",
  tension: "Tension",
  reveal: "Reveal",
  why: "Why it matters",
  loop: "Loop ending",
};

export type VisualType = "3d-motion" | "b-roll" | "logo" | "chart" | "kinetic-text" | "screenshot" | "photo";
export const VISUALS: Record<VisualType, string> = {
  "3d-motion": "3D motion graphic",
  "b-roll": "B-roll",
  logo: "Logo",
  chart: "Chart",
  "kinetic-text": "Kinetic text",
  screenshot: "Screenshot",
  photo: "Photo",
};

export type Transition = "cut" | "zoom-punch" | "whip-pan" | "glitch" | "light-leak" | "3d-flip" | "blur-slide";
export const TRANSITIONS: Record<Transition, string> = {
  cut: "Cut",
  "zoom-punch": "Zoom punch",
  "whip-pan": "Whip pan",
  glitch: "Glitch",
  "light-leak": "Light leak",
  "3d-flip": "3D flip",
  "blur-slide": "Blur slide",
};

export type ScriptLine = {
  part: Part;
  narration: string;
  visual: { type: VisualType; description: string };
  onScreenText: string;
  /** Transition INTO the next line. */
  transition: Transition;
  sfx: string;
  /** Research fact ids (G1, G2...) this line relies on. */
  facts: string[];
  /** Fact-check result for this line. */
  check: { ok: boolean; note?: string };
};

export type Hook = { text: string; style: "number" | "claim" | "question"; score: number; why: string };

export type ScriptScores = { hook: number; story: number; accuracy: number; pacing: number; loop: number; overall: number; notes: string[] };

export type ScriptContent = {
  title: string;
  description: string;
  hashtags: string[];
  hooks: Hook[];
  chosenHook: number;
  lines: ScriptLine[];
  scores: ScriptScores;
  /** Edited by hand since it was written (scores may be out of date). */
  edited: boolean;
};

export type ScriptStepKey = "research" | "hooks" | "write" | "check" | "finish";
export type ScriptStep = Omit<ResearchStep, "key"> & { key: ScriptStepKey };

export const SCRIPT_STEP_LABELS: Record<ScriptStepKey, string> = {
  research: "Researching the topic",
  hooks: "Writing 3 hooks and picking the best",
  write: "Writing the story script",
  check: "Fact-checking every line",
  finish: "Scoring and finishing",
};

export type Script = {
  id: number;
  researchId: number | null;
  topic: string;
  status: ScriptStatus;
  steps: ScriptStep[];
  content: ScriptContent | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScriptSummary = Pick<Script, "id" | "topic" | "status" | "createdAt"> & { title: string | null; overall: number | null; seconds: number | null };

export const wordCount = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
export const totalWords = (lines: Pick<ScriptLine, "narration">[]) => lines.reduce((sum, l) => sum + wordCount(l.narration), 0);
export const seconds = (words: number) => Math.round((words / WORDS_PER_SECOND) * 10) / 10;

/** Start time (m:ss) of each line, from the words spoken before it. */
export function lineTimes(lines: Pick<ScriptLine, "narration">[]): string[] {
  let words = 0;
  return lines.map((l) => {
    const s = Math.floor(words / WORDS_PER_SECOND);
    words += wordCount(l.narration);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  });
}

/** Check note for lines changed after the fact check (rewritten or edited by hand). */
export const UNCHECKED = "Changed after the fact check: not re-checked";
