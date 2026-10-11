import { deleteThumbnail, selectThumbnail } from "@/lib/thumbnails/thumbnails";

/** Choose this thumbnail for its Short and format. */
export async function POST(_req: Request, ctx: RouteContext<"/api/thumbnails/[thumbId]">) {
  const { thumbId } = await ctx.params;
  try {
    return Response.json(selectThumbnail(Number(thumbId)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/thumbnails/[thumbId]">) {
  const { thumbId } = await ctx.params;
  await deleteThumbnail(Number(thumbId));
  return Response.json({ ok: true });
}
