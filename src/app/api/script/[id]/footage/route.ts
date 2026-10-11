import { findClips, getClips } from "@/lib/footage/clips";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/footage">) {
  const { id } = await ctx.params;
  return Response.json({ clips: getClips(Number(id)) });
}

/** Find and download one vertical Pexels clip per scene (replaces any previous picks). */
export async function POST(_req: Request, ctx: RouteContext<"/api/script/[id]/footage">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ clips: await findClips(Number(id)) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
