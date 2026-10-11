import "server-only";

export type PexelsFile = { id: number; quality: string | null; file_type: string; width: number; height: number; fps: number; link: string };

export type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: { name: string; url: string };
  video_files: PexelsFile[];
};

function apiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is missing in .env.local");
  return key;
}

/** Search vertical stock videos. https://www.pexels.com/api/documentation/#videos-search */
export async function searchVideos(query: string, perPage = 15): Promise<PexelsVideo[]> {
  const params = new URLSearchParams({ query, orientation: "portrait", size: "medium", per_page: String(perPage) });
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: apiKey() },
  });
  if (!res.ok) throw new Error(`Pexels search "${query}" failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { videos: PexelsVideo[] };
  return json.videos;
}

/** Best MP4 for a 1080x1920 Short: exact 1080p portrait if offered, else the closest size that isn't tiny or 4K-heavy. */
export function pickFile(video: PexelsVideo): PexelsFile | null {
  const files = video.video_files.filter((f) => f.file_type === "video/mp4" && f.height > f.width && f.width >= 720);
  if (files.length === 0) return null;
  const score = (f: PexelsFile) => Math.abs(f.width - 1080) + (f.width < 1080 ? 500 : 0);
  return files.sort((a, b) => score(a) - score(b))[0];
}

export async function downloadFile(url: string, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
