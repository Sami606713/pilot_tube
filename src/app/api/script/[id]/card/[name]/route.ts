import { getCards } from "@/lib/cards/render";
import { serveFile } from "@/lib/http";

/** Stream a rendered card overlay (transparent WebM). */
export async function GET(req: Request, ctx: RouteContext<"/api/script/[id]/card/[name]">) {
  const { id, name } = await ctx.params;
  const card = getCards(Number(id)).find((c) => c.name === name);
  if (!card) return new Response("Not found", { status: 404 });
  return serveFile(req, card.filePath, "video/webm");
}
