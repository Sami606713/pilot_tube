import { autoPickMusic, getShortMusic, setShortMusic } from "@/lib/music/short-music";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/music">) {
  const { id } = await ctx.params;
  return Response.json(getShortMusic(Number(id)));
}

/** Body { "auto": true } reads the script's mood and picks a track; { "trackId": n | null } sets it by hand. */
export async function POST(req: Request, ctx: RouteContext<"/api/script/[id]/music">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { auto?: boolean; trackId?: number | null };
  try {
    if (body.auto) return Response.json(await autoPickMusic(Number(id)));
    const trackId = typeof body.trackId === "number" ? body.trackId : null;
    return Response.json(await setShortMusic(Number(id), trackId));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
