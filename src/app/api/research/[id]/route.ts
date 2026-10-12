import { deleteResearch, getResearch } from "@/lib/research/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/research/[id]">) {
  const research = getResearch(Number((await ctx.params).id));
  if (!research) return Response.json({ error: "Research not found" }, { status: 404 });
  return Response.json(research);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/research/[id]">) {
  deleteResearch(Number((await ctx.params).id));
  return Response.json({ ok: true });
}
