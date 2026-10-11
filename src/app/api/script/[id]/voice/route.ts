import { createVoiceover, getVoiceover } from "@/lib/voice/voiceover";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/voice">) {
  const { id } = await ctx.params;
  const voiceover = getVoiceover(Number(id));
  if (!voiceover) return Response.json({ error: "No voiceover yet" }, { status: 404 });
  return Response.json(voiceover);
}

/** Make (or remake) the voiceover and caption timings for a script. */
export async function POST(_req: Request, ctx: RouteContext<"/api/script/[id]/voice">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await createVoiceover(Number(id)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
