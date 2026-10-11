import { serveFile } from "@/lib/http";
import { getThumbnail } from "@/lib/thumbnails/thumbnails";

/** The finished thumbnail JPG (`?download=1` to save it). */
export async function GET(req: Request, ctx: RouteContext<"/api/thumbnails/[thumbId]/image">) {
  const { thumbId } = await ctx.params;
  const thumb = getThumbnail(Number(thumbId));
  if (!thumb) return new Response("Not found", { status: 404 });
  const res = await serveFile(req, thumb.filePath, "image/jpeg");
  if (new URL(req.url).searchParams.has("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="pilottube-thumbnail-${thumb.scriptId}-${thumb.format}-${thumb.id}.jpg"`);
  }
  return res;
}
