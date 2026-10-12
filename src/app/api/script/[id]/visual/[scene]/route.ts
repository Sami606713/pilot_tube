import { serveFile } from "@/lib/http";
import { getSceneVisuals } from "@/lib/scenes/visuals";

/** A scene's picture (Agnes PNG) or, for older Shorts, its stock clip (MP4). */
export async function GET(req: Request, ctx: RouteContext<"/api/script/[id]/visual/[scene]">) {
  const { id, scene } = await ctx.params;
  const visual = getSceneVisuals(Number(id)).find((v) => v.sceneIndex === Number(scene));
  if (!visual) return new Response("Not found", { status: 404 });
  return serveFile(req, visual.filePath, visual.kind === "video" ? "video/mp4" : "image/png");
}
