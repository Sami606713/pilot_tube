import { buildProps } from "@/lib/studio/engine";
import { getProject } from "@/lib/studio/store";

/** The project plus the props the in-browser preview plays. */
export async function GET(_req: Request, ctx: RouteContext<"/api/studio/[id]">) {
  const id = Number((await ctx.params).id);
  const project = getProject(id);
  if (!project) return Response.json({ error: "No video for this script yet" }, { status: 404 });
  return Response.json({ project, props: buildProps(project, `/api/studio/${id}/file`) });
}
