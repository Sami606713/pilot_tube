import { rewriteLine } from "@/lib/scripts/engine";
import { getScript } from "@/lib/scripts/store";

/** Body { index, instruction? }: Agnes rewrites one line (about 10-60s on a rate-limited key). */
export async function POST(req: Request, ctx: RouteContext<"/api/scripts/[id]/line">) {
  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => ({}))) as { index?: number; instruction?: string };
  if (typeof body.index !== "number") return Response.json({ error: "Which line?" }, { status: 400 });
  try {
    await rewriteLine(id, body.index, (body.instruction ?? "").slice(0, 300));
    return Response.json(getScript(id));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
