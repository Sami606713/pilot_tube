import "server-only";
import { createWriteStream } from "node:fs";
import { rename } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ClipOption } from "./types";

type PexelsFile = { quality: string | null; file_type: string; width: number; height: number; link: string };
type PexelsVideo = { id: number; width: number; height: number; duration: number; url: string; image: string; user: { name: string; url: string }; video_files: PexelsFile[] };

function apiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is missing in .env.local");
  return key;
}

/** Best MP4 for a 1080x1920 Short: 1080p portrait if offered, else the closest that isn't tiny or 4K-heavy. */
function pickFile(video: PexelsVideo): PexelsFile | null {
  const files = video.video_files.filter((f) => f.file_type === "video/mp4" && f.height > f.width && f.width >= 720);
  if (files.length === 0) return null;
  const score = (f: PexelsFile) => Math.abs(f.width - 1080) + (f.width < 1080 ? 500 : 0);
  return files.sort((a, b) => score(a) - score(b))[0];
}

/** Portrait stock videos for a query, as pickable options. https://www.pexels.com/api/documentation/#videos-search */
export async function searchClips(query: string, { perPage = 15, page = 1 } = {}): Promise<ClipOption[]> {
  const params = new URLSearchParams({ query, orientation: "portrait", size: "medium", per_page: String(perPage), page: String(page) });
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, { headers: { Authorization: apiKey() } });
  if (!res.ok) throw new Error(`Pexels search "${query}" failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const { videos } = (await res.json()) as { videos: PexelsVideo[] };
  return videos.flatMap((v) => {
    const file = pickFile(v);
    if (!file) return [];
    return [{ pexelsId: v.id, pageUrl: v.url, author: v.user.name, authorUrl: v.user.url, poster: v.image, fileUrl: file.link, width: file.width, height: file.height, duration: v.duration }];
  });
}

/** Stream a clip to disk; retries dropped connections (Pexels' CDN resets some parallel downloads). */
export async function downloadTo(url: string, file: string): Promise<void> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const tmp = `${file}.part`;
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
      await rename(tmp, file);
      return;
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error(`Download failed for ${url}: ${(last as Error)?.message ?? last}`);
}
