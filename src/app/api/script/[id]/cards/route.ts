import { getCards, renderCards } from "@/lib/cards/render";

export async function GET(_req: Request, ctx: RouteContext<"/api/script/[id]/cards">) {
  const { id } = await ctx.params;
  return Response.json({ cards: getCards(Number(id)) });
}

/** Render the hook, stat and outro overlays with HyperFrames (replaces previous renders). */
export async function POST(_req: Request, ctx: RouteContext<"/api/script/[id]/cards">) {
  const { id } = await ctx.params;
  try {
    return Response.json({ cards: await renderCards(Number(id)) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
