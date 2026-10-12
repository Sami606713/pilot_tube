import { after } from "next/server";
import { startScriptForDay } from "@/lib/planner/planner";
import { runScript } from "@/lib/scripts/engine";

/** Write the planned day's script (a typed topic gets Quick research first). Runs in the background. */
export async function POST(_req: Request, ctx: RouteContext<"/api/planner/[day]/script">) {
  try {
    const { scriptId, researchId, topic } = startScriptForDay((await ctx.params).day);
    after(() => runScript(scriptId, researchId ? { researchId } : { topic, timeRange: "week", depth: "quick" }));
    return Response.json({ scriptId });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
