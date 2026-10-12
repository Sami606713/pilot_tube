import { scheduleDay } from "@/lib/planner/planner";

/** Upload the day's video to YouTube as private, going public at the day's post time. */
export async function POST(_req: Request, ctx: RouteContext<"/api/planner/[day]/schedule">) {
  try {
    return Response.json(await scheduleDay((await ctx.params).day));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
