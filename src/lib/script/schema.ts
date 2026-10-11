import { z } from "zod";

export const sceneSchema = z.object({
  /** What the voice says during this scene (one or two short sentences). */
  narration: z.string().min(1),
  /** 2–4 word Pexels search for a matching vertical stock clip. */
  pexelsQuery: z.string().min(1),
});

export const shortScriptSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  hashtags: z.array(z.string()).min(1).max(8),
  /** First scene is the hook; last scene ends with a question to drive comments. */
  scenes: z.array(sceneSchema).min(4).max(10),
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

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
