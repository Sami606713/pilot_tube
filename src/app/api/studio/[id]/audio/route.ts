import { setAudio } from "@/lib/studio/audio";

/** Body { music?: trackId | "auto" | null, sfx?: boolean }. */
export async function POST(req: Request, ctx: RouteContext<"/api/studio/[id]/audio">) {
  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => ({}))) as { music?: number | "auto" | null; sfx?: boolean };
  const music = body.music === undefined || body.music === null || body.music === "auto" || typeof body.music === "number" ? body.music : undefined;
  try {
    return Response.json(await setAudio(id, { music, sfx: typeof body.sfx === "boolean" ? body.sfx : undefined }));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
