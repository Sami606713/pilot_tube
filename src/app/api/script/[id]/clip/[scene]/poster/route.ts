import { readFile } from "node:fs/promises";
import { getClips } from "@/lib/footage/clips";
import { ensurePoster } from "@/lib/footage/poster";

/** Small JPG still for a scene clip (created on first request for clips downloaded before posters existed). */
export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/clip/[scene]/poster">) {
  const { id, scene } = await ctx.params;
  const clip = getClips(Number(id)).find((c) => c.sceneIndex === Number(scene));
  if (!clip) return new Response("Not found", { status: 404 });
  const image = await readFile(await ensurePoster(clip.filePath));
  return new Response(new Uint8Array(image), {
    // The URL carries the Pexels id, so a new clip gets a new URL and this can be cached hard.
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
