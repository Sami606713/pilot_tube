import { clearDay, moveDay } from "@/lib/planner/planner";

/** Body { to: "YYYY-MM-DD" }: move the day's plan. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/planner/[day]">) {
  const { day } = await ctx.params;
  const { to } = (await req.json().catch(() => ({}))) as { to?: string };
  if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return Response.json({ error: "Pick a day" }, { status: 400 });
  try {
    moveDay(day, to);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

/** Remove the plan (the script, video and any upload stay). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/planner/[day]">) {
  clearDay((await ctx.params).day);
  return Response.json({ ok: true });
}
