import path from "node:path";
import { CLIP_DIR, getClip } from "@/lib/clips/clips";
import { serveFile } from "@/lib/serve-file";

/** The clip video; ?poster=1 for its still image, ?picture=1 for the first-frame source, ?download=1 to save. */
export async function GET(req: Request, ctx: RouteContext<"/api/clips/[id]/file">) {
  const id = Number((await ctx.params).id);
  const clip = getClip(id);
  if (!clip) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  if (q.has("picture")) return clip.picture ? serveFile(req, path.join(CLIP_DIR(), clip.picture), "image/jpeg") : new Response("Not found", { status: 404 });
  if (!clip.file) return new Response("Not ready", { status: 404 });
  if (q.has("poster")) return serveFile(req, path.join(CLIP_DIR(), `clip-${id}.jpg`), "image/jpeg");
  return serveFile(req, path.join(CLIP_DIR(), clip.file), "video/mp4", q.has("download") ? `clip-${id}.mp4` : undefined);
}
