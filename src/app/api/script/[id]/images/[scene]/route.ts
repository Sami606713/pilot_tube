import { redoSceneImage } from "@/lib/scenes/images";

/** Redraw one scene's picture. */
export async function POST(_req: Request, ctx: RouteContext<"/api/script/[id]/images/[scene]">) {
  const { id, scene } = await ctx.params;
  try {
    return Response.json({ visuals: await redoSceneImage(Number(id), Number(scene)) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
