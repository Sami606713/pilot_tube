import { deleteTrack, MOODS, updateTrackMood, type Mood } from "@/lib/music/library";
import { clearMusic } from "@/lib/studio/store";

/** Change a track's mood. Body: { "mood": "tense" | ... }. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/music/[trackId]">) {
  const { trackId } = await ctx.params;
  const { mood } = (await req.json().catch(() => ({}))) as { mood?: string };
  if (!mood || !MOODS.includes(mood as Mood)) return Response.json({ error: "Unknown mood" }, { status: 400 });
  try {
    return Response.json({ track: await updateTrackMood(Number(trackId), mood as Mood) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 404 });
  }
}

/** Delete a track; videos that used it play without music until another is picked. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/music/[trackId]">) {
  const id = Number((await ctx.params).trackId);
  clearMusic(id);
  await deleteTrack(id);
  return Response.json({ ok: true });
}
