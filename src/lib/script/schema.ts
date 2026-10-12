import { z } from "zod";

export const sceneSchema = z.object({
  /** What the voice says during this scene (one or two short sentences). */
  narration: z.string().min(1),
  /** One-sentence picture idea for this scene; Agnes draws it. */
  visual: z.string().min(1).optional(),
  /** Older scripts (before Agnes scene images) had a stock-footage search instead. */
  pexelsQuery: z.string().min(1).optional(),
});

export const shortScriptSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  hashtags: z.array(z.string()).min(1).max(8),
  /** First scene is the hook; last scene ends with a question to drive comments. */
  scenes: z.array(sceneSchema).min(4).max(14),
  /** Text for the HyperFrames graphic cards (built in a later phase). */
  cards: z.object({
    hook: z.string().min(1).max(60),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).max(3),
    outro: z.string().min(1).max(60),
  }),
});

export type ShortScript = z.infer<typeof shortScriptSchema>;

export function fullNarration(script: Pick<ShortScript, "scenes">): string {
  return script.scenes.map((s) => s.narration.trim()).join(" ");
}

/** The picture idea for a scene, falling back for scripts written before `visual` existed. */
export function sceneVisual(scene: z.infer<typeof sceneSchema>): string {
  return scene.visual ?? scene.pexelsQuery ?? scene.narration;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
