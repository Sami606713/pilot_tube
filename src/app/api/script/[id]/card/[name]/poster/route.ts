import { readFile } from "node:fs/promises";
import { ensureCardPoster, getCards } from "@/lib/cards/render";

/** Transparent PNG still of a card overlay. */
export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/card/[name]/poster">) {
  const { id, name } = await ctx.params;
  const card = getCards(Number(id)).find((c) => c.name === name);
  if (!card) return new Response("Not found", { status: 404 });
  const image = await readFile(await ensureCardPoster(card.filePath));
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
