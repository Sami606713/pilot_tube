import { chooseThumbnail, deleteThumbnail } from "@/lib/thumbnails/thumbnails";

/** Choose this thumbnail for its video. */
export async function PATCH(_req: Request, ctx: RouteContext<"/api/thumbnails/[id]">) {
  try {
    chooseThumbnail(Number((await ctx.params).id));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/thumbnails/[id]">) {
  await deleteThumbnail(Number((await ctx.params).id));
  return Response.json({ ok: true });
}
