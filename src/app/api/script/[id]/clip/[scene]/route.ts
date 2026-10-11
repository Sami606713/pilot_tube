import { getClips } from "@/lib/footage/clips";
import { serveFile } from "@/lib/http";

/** Stream a downloaded scene clip. */
export async function GET(req: Request, ctx: RouteContext<"/api/script/[id]/clip/[scene]">) {
  const { id, scene } = await ctx.params;
  const clip = getClips(Number(id)).find((c) => c.sceneIndex === Number(scene));
  if (!clip) return new Response("Not found", { status: 404 });
  return serveFile(req, clip.filePath, "video/mp4");
}
