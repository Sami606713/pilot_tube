import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { agnes } from "@/lib/agnes";
import { generateAgnesImage } from "@/lib/agnes-image";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { ensurePoster } from "@/lib/media/poster";
import { sceneVisual, type ShortScript } from "@/lib/script/schema";
import { videoDir } from "@/lib/voice/voiceover";
import { getSceneVisuals, type SceneVisual } from "./visuals";

// Free Agnes keys allow only a few pictures per minute, so draw 3 at a time (429s are retried in generateAgnesImage).
const CONCURRENCY = 3;

const promptsSchema = z.object({ style: z.string().min(5), prompts: z.array(z.string().min(10)) });

async function loadScript(scriptId: number): Promise<{ script: ShortScript; storyTitle: string }> {
  const row = getDb()
    .prepare(`SELECT sc.data, st.title AS story_title FROM scripts sc JOIN stories st ON st.id = sc.story_id WHERE sc.id = ?`)
    .get(scriptId) as { data: string; story_title: string } | undefined;
  if (!row) throw new Error(`Short #${scriptId} not found`);
  return { script: JSON.parse(row.data) as ShortScript, storyTitle: row.story_title };
}

/**
 * Agnes (text) turns every scene's picture idea into a full image prompt, with ONE shared visual style,
 * so the Short looks like a single film instead of unrelated pictures.
 */
async function scenePrompts(script: ShortScript, storyTitle: string): Promise<string[]> {
  const scenes = script.scenes.map((s, i) => `${i + 1}. Voice: "${s.narration}"\n   Picture idea: ${sceneVisual(s)}`).join("\n");
  const res = await agnes().chat.completions.create({
    model: env().AGNES_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You art-direct a vertical (9:16) YouTube Short about AI news. Each scene needs one picture.
First choose ONE visual style for the whole Short (lighting, color palette, camera feel), e.g. "cinematic dark tech photography, deep blacks, teal and red neon accents, shallow depth of field".
Then write one image prompt per scene: a single clear subject that matches the voice line, strong composition, room in the lower-middle for captions.
No text, letters, logos or real people's faces (use silhouettes, robots, hands, devices, objects, places).
Reply with ONLY JSON: {"style": string, "prompts": [string, ...]} with exactly one prompt per scene, in order.`,
      },
      { role: "user", content: `Story: ${storyTitle}\nHeadline: ${script.cards.hook}\n\nScenes:\n${scenes}` },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  const parsed = promptsSchema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  // If Agnes returns the wrong count, fall back to each scene's own picture idea for the missing ones.
  return script.scenes.map((s, i) => `${parsed.prompts[i] ?? sceneVisual(s)}. Style: ${parsed.style}. Vertical 9:16 composition.`);
}

async function drawScene(scriptId: number, sceneIndex: number, prompt: string): Promise<void> {
  const dir = path.join(videoDir(scriptId), "images");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `scene-${sceneIndex + 1}-${Date.now()}.png`);
  await generateAgnesImage(prompt, "9:16", filePath);
  await ensurePoster(filePath);
  getDb()
    .prepare(`INSERT OR REPLACE INTO scene_images (script_id, scene_index, prompt, file_path, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(scriptId, sceneIndex, prompt, filePath, new Date().toISOString());
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        await fn(items[i]);
        results[i] = { status: "fulfilled", value: undefined };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Draw a 9:16 Agnes picture per scene. `missingOnly` keeps scenes that already have an Agnes picture
 * (to finish a run that hit the rate limit); otherwise every scene is redrawn.
 */
export async function createSceneImages(scriptId: number, opts: { missingOnly?: boolean } = {}): Promise<SceneVisual[]> {
  const { script, storyTitle } = await loadScript(scriptId);
  const prompts = await scenePrompts(script, storyTitle);
  const drawn = new Set(getSceneVisuals(scriptId).filter((v) => v.kind === "image").map((v) => v.sceneIndex));
  const todo = prompts.map((prompt, sceneIndex) => ({ prompt, sceneIndex })).filter((t) => !(opts.missingOnly && drawn.has(t.sceneIndex)));
  const results = await mapLimit(
    todo,
    CONCURRENCY,
    ({ prompt, sceneIndex }) => drawScene(scriptId, sceneIndex, prompt),
  );
  const failed = results.flatMap((r, i) => (r.status === "rejected" ? [`scene ${todo[i].sceneIndex + 1}: ${(r.reason as Error).message}`] : []));
  if (todo.length && failed.length === todo.length) throw new Error(`No pictures could be made. ${failed[0]}`);
  if (failed.length) throw new Error(`${todo.length - failed.length} of ${todo.length} pictures made. Press "Fill missing images" in a minute to finish (${failed[0]})`);
  return getSceneVisuals(scriptId);
}

/** Redraw one scene. Keeps its prompt; Agnes gives a different picture each time. */
export async function redoSceneImage(scriptId: number, sceneIndex: number): Promise<SceneVisual[]> {
  const existing = getSceneVisuals(scriptId).find((v) => v.sceneIndex === sceneIndex && v.kind === "image");
  let prompt = existing?.prompt;
  if (!prompt) {
    const { script, storyTitle } = await loadScript(scriptId);
    if (!script.scenes[sceneIndex]) throw new Error(`Scene ${sceneIndex + 1} not found`);
    prompt = (await scenePrompts(script, storyTitle))[sceneIndex];
  }
  await drawScene(scriptId, sceneIndex, prompt);
  return getSceneVisuals(scriptId);
}
