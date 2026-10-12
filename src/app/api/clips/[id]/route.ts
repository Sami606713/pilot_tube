import { after } from "next/server";
import { deleteClip, resetClip, runClip } from "@/lib/clips/clips";

/** Retry a failed clip. */
export async function POST(_req: Request, ctx: RouteContext<"/api/clips/[id]">) {
  const id = Number((await ctx.params).id);
  const clip = resetClip(id);
  if (!clip) return Response.json({ error: "Clip not found" }, { status: 404 });
  after(() => runClip(id));
  return Response.json(clip);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/clips/[id]">) {
  await deleteClip(Number((await ctx.params).id));
  return Response.json({ ok: true });
}
