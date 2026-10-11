import { serveFile } from "@/lib/http";
import { getVoiceover } from "@/lib/voice/voiceover";

/** Stream the voiceover MP3 so the dashboard can play and seek it. */
export async function GET(req: Request, ctx: RouteContext<"/api/script/[id]/audio">) {
  const { id } = await ctx.params;
  const voiceover = getVoiceover(Number(id));
  if (!voiceover) return new Response("Not found", { status: 404 });
  return serveFile(req, voiceover.audioPath, "audio/mpeg");
}
