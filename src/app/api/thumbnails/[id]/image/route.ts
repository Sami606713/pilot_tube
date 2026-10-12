import { serveFile } from "@/lib/serve-file";
import { getThumbnail, thumbnailPath } from "@/lib/thumbnails/thumbnails";

export async function GET(req: Request, ctx: RouteContext<"/api/thumbnails/[id]/image">) {
  const id = Number((await ctx.params).id);
  const t = getThumbnail(id);
  if (!t) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download") ? `thumbnail-${id}.jpg` : undefined;
  return serveFile(req, thumbnailPath(t), "image/jpeg", download);
}
