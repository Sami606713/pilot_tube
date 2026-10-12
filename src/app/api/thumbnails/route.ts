import { customThumbnails, listThumbnails, SHAPES, thumbnailsForVideo, type Shape } from "@/lib/thumbnails/thumbnails";

export async function GET() {
  return Response.json({ thumbnails: listThumbnails() });
}

/**
 * { scriptId, shape, headline? } → 3 thumbnails for a video; { prompt, shape, headline? } → 3 custom ones.
 * Takes about 15-60s (Agnes Image; free keys wait on rate limits).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { scriptId?: number; prompt?: string; shape?: string; headline?: string };
  const shape: Shape = body.shape && body.shape in SHAPES ? (body.shape as Shape) : "9:16";
  const headline = (body.headline ?? "").trim().replace(/\s+/g, " ").slice(0, 40) || null;
  try {
    if (typeof body.scriptId === "number") return Response.json(await thumbnailsForVideo(body.scriptId, shape, headline));
    const prompt = (body.prompt ?? "").trim();
    if (prompt.length < 5) return Response.json({ error: "Describe the picture (at least a few words)" }, { status: 400 });
    return Response.json(await customThumbnails(prompt.slice(0, 500), shape, headline));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
