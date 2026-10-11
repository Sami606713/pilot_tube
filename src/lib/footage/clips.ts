import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db";
import type { ShortScript } from "@/lib/script/schema";
import { getVoiceover, videoDir } from "@/lib/voice/voiceover";
import { downloadFile, pickFile, searchVideos, type PexelsVideo } from "./pexels";
import { ensurePoster } from "./poster";

// Used when a scene's own search finds nothing usable.
const FALLBACK_QUERIES = ["technology abstract", "digital network", "computer code screen", "futuristic city night", "data center"];
// Don't reuse a Pexels clip that appeared in any Short in this many days, so videos don't look copy-pasted.
const REUSE_COOLDOWN_DAYS = 30;
// Pick randomly among this many of the best matches, so the same query doesn't always give the same clip.
const TOP_N = 4;
const DOWNLOAD_CONCURRENCY = 3;

export type Clip = {
  sceneIndex: number;
  query: string;
  pexelsId: number;
  pexelsUrl: string;
  author: string;
  authorUrl: string;
  filePath: string;
  width: number;
  height: number;
  duration: number;
  /** How long the scene lasts in the voiceover. */
  sceneDuration: number;
};

type ClipRow = {
  scene_index: number;
  query: string;
  pexels_id: number;
  pexels_url: string;
  author: string;
  author_url: string;
  file_path: string;
  width: number;
  height: number;
  duration: number;
};

function recentlyUsedIds(excludeScriptId: number): Set<number> {
  const since = new Date(Date.now() - REUSE_COOLDOWN_DAYS * 86400_000).toISOString().replace("T", " ").slice(0, 19);
  const rows = getDb()
    .prepare(`SELECT pexels_id FROM clips WHERE script_id != ? AND created_at >= ?`)
    .all(excludeScriptId, since) as { pexels_id: number }[];
  return new Set(rows.map((r) => r.pexels_id));
}

function queriesFor(query: string, sceneIndex: number): string[] {
  const words = query.trim().split(/\s+/);
  const shorter = words.length > 2 ? [words.slice(0, 2).join(" "), words.slice(-2).join(" ")] : [];
  // Rotate fallbacks by scene so two failing scenes don't land on the same generic clip.
  const fallbacks = [...FALLBACK_QUERIES.slice(sceneIndex % FALLBACK_QUERIES.length), ...FALLBACK_QUERIES.slice(0, sceneIndex % FALLBACK_QUERIES.length)];
  return [...new Set([query, ...shorter, ...fallbacks])];
}

function choose(videos: PexelsVideo[], minDuration: number, excluded: Set<number>): PexelsVideo | null {
  const usable = videos.filter((v) => !excluded.has(v.id) && pickFile(v));
  if (usable.length === 0) return null;
  const longEnough = usable.filter((v) => v.duration >= minDuration);
  if (longEnough.length > 0) {
    const top = longEnough.slice(0, TOP_N);
    return top[Math.floor(Math.random() * top.length)];
  }
  // Nothing long enough: take the longest; the renderer will slow it down or loop it.
  return usable.sort((a, b) => b.duration - a.duration)[0];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Find, download and save one vertical Pexels clip per scene. */
export async function findClips(scriptId: number): Promise<Clip[]> {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM scripts WHERE id = ?`).get(scriptId) as { data: string } | undefined;
  if (!row) throw new Error(`Script #${scriptId} not found`);
  const script = JSON.parse(row.data) as ShortScript;

  // Real scene lengths come from the voiceover; without one, estimate from word count (~2.5 words/sec).
  const voiceover = getVoiceover(scriptId);
  const sceneDurations = script.scenes.map((scene, i) => {
    const timing = voiceover?.scenes[i];
    return timing ? timing.end - timing.start : scene.narration.split(/\s+/).length / 2.5;
  });

  const excluded = recentlyUsedIds(scriptId);
  const searchCache = new Map<string, PexelsVideo[]>();
  const search = async (q: string) => {
    if (!searchCache.has(q)) searchCache.set(q, await searchVideos(q));
    return searchCache.get(q)!;
  };

  // Searches run one scene at a time so each scene can exclude clips the earlier scenes took.
  const picks: { sceneIndex: number; query: string; video: PexelsVideo }[] = [];
  for (const [sceneIndex, scene] of script.scenes.entries()) {
    const need = sceneDurations[sceneIndex] + 0.5;
    let picked: { query: string; video: PexelsVideo } | null = null;
    for (const q of queriesFor(scene.pexelsQuery, sceneIndex)) {
      const video = choose(await search(q), need, excluded);
      if (video) {
        picked = { query: q, video };
        break;
      }
    }
    if (!picked) throw new Error(`No usable Pexels clip for scene ${sceneIndex + 1} ("${scene.pexelsQuery}")`);
    excluded.add(picked.video.id);
    picks.push({ sceneIndex, ...picked });
  }

  const clipsDir = path.join(videoDir(scriptId), "clips");
  await rm(clipsDir, { recursive: true, force: true });
  await mkdir(clipsDir, { recursive: true });

  const clips = await mapLimit(picks, DOWNLOAD_CONCURRENCY, async ({ sceneIndex, query, video }) => {
    const file = pickFile(video)!;
    const filePath = path.join(clipsDir, `scene-${sceneIndex + 1}-${video.id}.mp4`);
    await writeFile(filePath, await downloadFile(file.link, AbortSignal.timeout(120_000)));
    await ensurePoster(filePath);
    return {
      sceneIndex,
      query,
      pexelsId: video.id,
      pexelsUrl: video.url,
      author: video.user.name,
      authorUrl: video.user.url,
      filePath,
      width: file.width,
      height: file.height,
      duration: video.duration,
      sceneDuration: sceneDurations[sceneIndex],
    } satisfies Clip;
  });

  db.prepare(`DELETE FROM clips WHERE script_id = ?`).run(scriptId);
  const insert = db.prepare(
    `INSERT INTO clips (script_id, scene_index, query, pexels_id, pexels_url, author, author_url, file_path, width, height, duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of clips) {
    insert.run(scriptId, c.sceneIndex, c.query, c.pexelsId, c.pexelsUrl, c.author, c.authorUrl, c.filePath, c.width, c.height, c.duration);
  }
  db.prepare(`UPDATE scripts SET status = 'footage' WHERE id = ?`).run(scriptId);

  return clips;
}

export function getClips(scriptId: number): Clip[] {
  const rows = getDb()
    .prepare(`SELECT * FROM clips WHERE script_id = ? ORDER BY scene_index`)
    .all(scriptId) as ClipRow[];
  const voiceover = getVoiceover(scriptId);
  return rows.map((r) => {
    const timing = voiceover?.scenes[r.scene_index];
    return {
      sceneIndex: r.scene_index,
      query: r.query,
      pexelsId: r.pexels_id,
      pexelsUrl: r.pexels_url,
      author: r.author,
      authorUrl: r.author_url,
      filePath: r.file_path,
      width: r.width,
      height: r.height,
      duration: r.duration,
      sceneDuration: timing ? timing.end - timing.start : 0,
    };
  });
}
