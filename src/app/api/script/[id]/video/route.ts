import { serveFile } from "@/lib/http";
import { getRender } from "@/lib/render/render";

/** Stream (or download with ?download=1) the rendered Short. */
export async function GET(req: Request, ctx: RouteContext<"/api/script/[id]/video">) {
  const { id } = await ctx.params;
  const render = getRender(Number(id));
  if (!render) return new Response("Not found", { status: 404 });
  const res = await serveFile(req, render.filePath, "video/mp4");
  if (new URL(req.url).searchParams.has("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="pilottube-short-${id}.mp4"`);
  }
  return res;
}
