import { setSfx } from "@/lib/studio/audio";

/** Body { sfx: boolean }: sound effects on or off. */
export async function POST(req: Request, ctx: RouteContext<"/api/studio/[id]/audio">) {
  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => ({}))) as { sfx?: boolean };
  if (typeof body.sfx !== "boolean") return Response.json({ error: "Send { sfx: true | false }" }, { status: 400 });
  try {
    return Response.json(await setSfx(id, body.sfx));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
