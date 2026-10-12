import { aiClipForLine, chooseClip, regenerateLine, setLineMode, applyLibraryClip } from "@/lib/studio/engine";
import { MODES, SCENES, type LineMode, type Scene3D } from "@/lib/studio/types";

/**
 * { index, pexelsId } picks a footage option; { index, regenerate: true, query? } finds 3 new ones;
 * { index, mode, scene? } switches how the line is shown; { index, ai: true } tries an Agnes AI clip (up to ~4 min);
 * { index, clipId } uses a finished clip from the Clips library.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/studio/[id]/line">) {
  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => ({}))) as { index?: number; pexelsId?: number; regenerate?: boolean; query?: string; mode?: string; scene?: string; ai?: boolean; clipId?: number };
  if (typeof body.index !== "number") return Response.json({ error: "Which line?" }, { status: 400 });
  try {
    if (body.ai) return Response.json(await aiClipForLine(id, body.index));
    if (typeof body.clipId === "number") return Response.json(await applyLibraryClip(id, body.index, body.clipId));
    if (body.mode) {
      if (!(body.mode in MODES)) return Response.json({ error: "Unknown mode" }, { status: 400 });
      const scene = body.scene && body.scene in SCENES ? (body.scene as Scene3D) : undefined;
      return Response.json(await setLineMode(id, body.index, body.mode as LineMode, scene));
    }
    if (body.regenerate) return Response.json(await regenerateLine(id, body.index, (body.query ?? "").slice(0, 80)));
    if (typeof body.pexelsId !== "number") return Response.json({ error: "Which clip?" }, { status: 400 });
    return Response.json(await chooseClip(id, body.index, body.pexelsId));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
