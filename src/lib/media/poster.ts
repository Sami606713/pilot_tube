import "server-only";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * A small JPG still (270px wide, ~15 KB) next to a scene picture or clip, made once with FFmpeg.
 * The dashboard shows these instead of loading full-size media.
 */
export async function ensurePoster(mediaPath: string): Promise<string> {
  const posterPath = mediaPath.replace(/\.(mp4|png|jpe?g|webp)$/i, ".poster.jpg");
  try {
    await access(posterPath);
    return posterPath;
  } catch {
    // Not made yet.
  }
  const isVideo = /\.mp4$/i.test(mediaPath);
  await run(
    "ffmpeg",
    ["-v", "error", "-y", ...(isVideo ? ["-ss", "1"] : []), "-i", mediaPath, "-frames:v", "1", "-vf", "scale=270:-2", "-q:v", "5", posterPath],
    { timeout: 30_000 },
  );
  return posterPath;
}
