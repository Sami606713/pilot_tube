import { getRender, renderShort } from "@/lib/render/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/render">) {
  const { id } = await ctx.params;
  const render = getRender(Number(id));
  if (!render) return Response.json({ error: "Not rendered yet" }, { status: 404 });
  return Response.json(render);
}

/** Render the final MP4 with Remotion (replaces any previous render). */
export async function POST(_req: Request, ctx: RouteContext<"/api/script/[id]/render">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await renderShort(Number(id)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
