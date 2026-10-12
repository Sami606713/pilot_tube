import { planDay, setPostTime } from "@/lib/planner/planner";

/** Body { day, topic? | researchId? | scriptId? } plans a day; { postTime: "18:00" } sets the daily post time. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { day?: string; topic?: string; researchId?: number; scriptId?: number; postTime?: string };
  try {
    if (body.postTime) {
      setPostTime(body.postTime);
      return Response.json({ ok: true });
    }
    if (!body.day || !/^\d{4}-\d{2}-\d{2}$/.test(body.day)) return Response.json({ error: "Which day?" }, { status: 400 });
    planDay(body.day, { topic: body.topic, researchId: body.researchId, scriptId: body.scriptId });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
