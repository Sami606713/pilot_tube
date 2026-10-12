import { createSceneImages } from "@/lib/scenes/images";
import { getSceneVisuals } from "@/lib/scenes/visuals";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/images">) {
  const { id } = await ctx.params;
  return Response.json({ visuals: getSceneVisuals(Number(id)) });
}

/** Draw an Agnes picture for every scene (about 30-40s). `?missing=1` only fills scenes without one. */
export async function POST(req: Request, ctx: RouteContext<"/api/script/[id]/images">) {
  const { id } = await ctx.params;
  const missingOnly = new URL(req.url).searchParams.has("missing");
  try {
    return Response.json({ visuals: await createSceneImages(Number(id), { missingOnly }) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
