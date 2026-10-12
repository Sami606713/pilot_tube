import path from "node:path";
import { serveFile } from "@/lib/serve-file";
import { videoDir } from "@/lib/studio/store";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg", ".png": "image/png" };

/** Serves a video's own files (voice, clips, logos, sounds, music, final) so the preview can play and seek them. */
export async function GET(req: Request, ctx: RouteContext<"/api/studio/[id]/file/[name]">) {
  const { id, name } = await ctx.params;
  if (!/^[\w.-]+\.(mp4|mp3|m4a|wav|ogg|png)$/.test(name)) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download") ? `short-${id}.mp4` : undefined;
  return serveFile(req, path.join(videoDir(Number(id)), name), TYPES[path.extname(name)] ?? "application/octet-stream", download);
}
