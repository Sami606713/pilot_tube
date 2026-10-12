import { createMotionGraphics, getMotionGraphics } from "@/lib/motion/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/motion">) {
  const { id } = await ctx.params;
  const motion = getMotionGraphics(Number(id));
  if (!motion) return Response.json({ error: "No motion graphics yet" }, { status: 404 });
  return Response.json(motion);
}

/** Turn the script into a motion graphics video with HyperFrames (replaces the previous one). */
export async function POST(_req: Request, ctx: RouteContext<"/api/script/[id]/motion">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await createMotionGraphics(Number(id)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
