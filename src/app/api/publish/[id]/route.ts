import { publishChecks, publishDefaults, publishShort, reschedule, setVisibility, type Privacy } from "@/lib/publish/youtube";

const PRIVACY: Privacy[] = ["public", "unlisted", "private"];

/** Defaults and checks for the publish form. */
export async function GET(_req: Request, ctx: RouteContext<"/api/publish/[id]">) {
  const id = Number((await ctx.params).id);
  try {
    const defaults = publishDefaults(id);
    return Response.json({ ...defaults, checks: await publishChecks(id, defaults) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}

/**
 * { title, description, privacy, publishAt? } uploads the Short.
 * { action: "schedule", publishAt } changes the go-live time; { action: "visibility", privacy } publishes now or cancels a schedule.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/publish/[id]">) {
  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => ({}))) as {
    action?: "schedule" | "visibility";
    title?: string;
    description?: string;
    privacy?: string;
    publishAt?: string | null;
  };
  const privacy = PRIVACY.includes(body.privacy as Privacy) ? (body.privacy as Privacy) : null;
  const publishAt = body.publishAt && !Number.isNaN(Date.parse(body.publishAt)) ? new Date(body.publishAt).toISOString() : null;
  try {
    if (body.action === "schedule") {
      if (!publishAt) return Response.json({ error: "Pick a date and time" }, { status: 400 });
      return Response.json(await reschedule(id, publishAt));
    }
    if (body.action === "visibility") {
      if (!privacy) return Response.json({ error: "Unknown visibility" }, { status: 400 });
      return Response.json(await setVisibility(id, privacy));
    }
    if (!body.title || body.description === undefined || !privacy) return Response.json({ error: "Title, description and visibility are required" }, { status: 400 });
    return Response.json(await publishShort(id, { title: body.title, description: body.description, privacy, publishAt }));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
