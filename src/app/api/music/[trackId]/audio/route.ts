import { serveFile } from "@/lib/http";
import { getTrack } from "@/lib/music/library";

const TYPES: Record<string, string> = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg" };

/** Stream a library track for the preview players. */
export async function GET(req: Request, ctx: RouteContext<"/api/music/[trackId]/audio">) {
  const { trackId } = await ctx.params;
  const track = getTrack(Number(trackId));
  if (!track) return new Response("Not found", { status: 404 });
  const ext = track.filePath.slice(track.filePath.lastIndexOf(".")).toLowerCase();
  return serveFile(req, track.filePath, TYPES[ext] ?? "audio/mpeg");
}
