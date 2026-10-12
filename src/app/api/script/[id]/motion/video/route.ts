import { serveFile } from "@/lib/http";
import { getMotionGraphics } from "@/lib/motion/render";

/** Stream (or `?download=1`) the motion graphics MP4. */
export async function GET(req: Request, ctx: RouteContext<"/api/script/[id]/motion/video">) {
  const { id } = await ctx.params;
  const motion = getMotionGraphics(Number(id));
  if (!motion) return new Response("Not found", { status: 404 });
  const res = await serveFile(req, motion.filePath, "video/mp4");
  if (new URL(req.url).searchParams.has("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="pilottube-motion-${id}.mp4"`);
  }
  return res;
}
