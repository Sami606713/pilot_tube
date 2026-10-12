import { after } from "next/server";
import { renderVideo } from "@/lib/studio/engine";
import { getProject } from "@/lib/studio/store";

export async function POST(_req: Request, ctx: RouteContext<"/api/studio/[id]/render">) {
  const id = Number((await ctx.params).id);
  const p = getProject(id);
  if (!p?.voice || p.lines.length === 0) return Response.json({ error: "Make the voice and visuals first" }, { status: 400 });
  if (p.status === "running" || p.status === "rendering") return Response.json({ error: "Already working on this video" }, { status: 409 });
  after(() => renderVideo(id));
  return Response.json({ ok: true });
}
