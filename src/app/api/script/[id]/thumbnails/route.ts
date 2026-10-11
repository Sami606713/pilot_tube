import { createThumbnails, FORMATS, listThumbnails, type ThumbnailFormat } from "@/lib/thumbnails/thumbnails";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/thumbnails">) {
  const { id } = await ctx.params;
  return Response.json({ thumbnails: listThumbnails(Number(id)) });
}

/** Make 3 new thumbnail options. Body: { "format": "short" | "wide" } (default "short"). */
export async function POST(req: Request, ctx: RouteContext<"/api/script/[id]/thumbnails">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { format?: string };
  const format: ThumbnailFormat = body.format && body.format in FORMATS ? (body.format as ThumbnailFormat) : "short";
  try {
    return Response.json({ thumbnails: await createThumbnails(Number(id), format) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
