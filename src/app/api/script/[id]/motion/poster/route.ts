import { readFile } from "node:fs/promises";
import { ensurePoster } from "@/lib/media/poster";
import { getMotionGraphics } from "@/lib/motion/render";

/** Cover image for the motion graphics player (a frame 1s in, once the first screen has animated in). */
export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/motion/poster">) {
  const { id } = await ctx.params;
  const motion = getMotionGraphics(Number(id));
  if (!motion) return new Response("Not found", { status: 404 });
  const image = await readFile(await ensurePoster(motion.filePath));
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
