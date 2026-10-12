import "server-only";
import { getDb } from "@/lib/db";
import { getVoiceover } from "@/lib/voice/voiceover";

/**
 * What a scene shows. New Shorts use an Agnes picture per scene; Shorts made before that still
 * have their downloaded stock clip on disk (the old `clips` table), which keeps working read-only.
 */
export type SceneVisual = {
  sceneIndex: number;
  kind: "image" | "video";
  filePath: string;
  /** Picture prompt for Agnes images; null for old clips. */
  prompt: string | null;
  /** Changes whenever the file changes; used as the URL cache key. */
  version: string;
  /** Clip length in seconds (videos only). */
  duration: number | null;
  /** How long the scene lasts in the voiceover (0 before the voice exists). */
  sceneDuration: number;
  /** Photographer credit, for old stock clips. */
  credit: { author: string; url: string } | null;
};

type ImageRow = { scene_index: number; prompt: string; file_path: string; created_at: string };
type LegacyClipRow = { scene_index: number; pexels_id: number; pexels_url: string; author: string; file_path: string; duration: number };

export function getSceneVisuals(scriptId: number): SceneVisual[] {
  const db = getDb();
  const images = db.prepare(`SELECT * FROM scene_images WHERE script_id = ? ORDER BY scene_index`).all(scriptId) as ImageRow[];
  const clips = db.prepare(`SELECT * FROM clips WHERE script_id = ? ORDER BY scene_index`).all(scriptId) as LegacyClipRow[];
  const timings = getVoiceover(scriptId)?.scenes ?? [];
  const sceneDuration = (i: number) => (timings[i] ? timings[i].end - timings[i].start : 0);

  const byScene = new Map<number, SceneVisual>();
  for (const c of clips) {
    byScene.set(c.scene_index, {
      sceneIndex: c.scene_index,
      kind: "video",
      filePath: c.file_path,
      prompt: null,
      version: String(c.pexels_id),
      duration: c.duration,
      sceneDuration: sceneDuration(c.scene_index),
      credit: { author: c.author, url: c.pexels_url },
    });
  }
  // An Agnes picture replaces an old clip for the same scene.
  for (const img of images) {
    byScene.set(img.scene_index, {
      sceneIndex: img.scene_index,
      kind: "image",
      filePath: img.file_path,
      prompt: img.prompt,
      version: img.created_at,
      duration: null,
      sceneDuration: sceneDuration(img.scene_index),
      credit: null,
    });
  }
  return [...byScene.values()].sort((a, b) => a.sceneIndex - b.sceneIndex);
}

/** Browser URLs for a scene's media and its small poster. */
export function visualUrls(scriptId: number, v: Pick<SceneVisual, "sceneIndex" | "version">) {
  const base = `/api/script/${scriptId}/visual/${v.sceneIndex}`;
  const q = `?v=${encodeURIComponent(v.version)}`;
  return { src: `${base}${q}`, poster: `${base}/poster${q}` };
}
