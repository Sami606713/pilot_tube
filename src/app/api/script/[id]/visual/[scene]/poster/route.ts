import { readFile } from "node:fs/promises";
import { ensurePoster } from "@/lib/media/poster";
import { getSceneVisuals } from "@/lib/scenes/visuals";

/** Small JPG of a scene's picture or clip (made on first request, then cached by URL version). */
export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/visual/[scene]/poster">) {
  const { id, scene } = await ctx.params;
  const visual = getSceneVisuals(Number(id)).find((v) => v.sceneIndex === Number(scene));
  if (!visual) return new Response("Not found", { status: 404 });
  const image = await readFile(await ensurePoster(visual.filePath));
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
