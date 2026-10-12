import { deleteTrack, MOODS, updateTrackMood, type Mood } from "@/lib/music/library";
import { remixMotionMusic } from "@/lib/music/short-music";

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

export async function DELETE(_req: Request, ctx: RouteContext<"/api/music/[trackId]">) {
  const { trackId } = await ctx.params;
  // Shorts that used the track lose their music, so their motion graphics are re-mixed silent.
  for (const scriptId of await deleteTrack(Number(trackId))) await remixMotionMusic(scriptId);
  return Response.json({ ok: true });
}
