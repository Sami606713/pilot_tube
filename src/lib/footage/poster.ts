import "server-only";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * A small JPG still (270px wide, ~15 KB) next to the clip, made once with FFmpeg.
 * The dashboard shows these instead of autoplaying full 1080p clips.
 */
export async function ensurePoster(clipPath: string): Promise<string> {
  const posterPath = clipPath.replace(/\.mp4$/, ".jpg");
  try {
    await access(posterPath);
    return posterPath;
  } catch {
    // Not made yet.
  }
  await run("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", clipPath, "-frames:v", "1", "-vf", "scale=270:-2", "-q:v", "5", posterPath], {
    timeout: 30_000,
  });
  return posterPath;
}
