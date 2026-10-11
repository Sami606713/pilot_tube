import { generateScript, listScripts } from "@/lib/script/generate";

export async function GET() {
  return Response.json({ scripts: listScripts() });
}

/**
 * Write a Shorts script. Body `{ "storyId": 42 }` uses that story (from the Research page);
 * no body lets Agnes pick today's best AI story.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { storyId?: unknown };
    const storyId = typeof body.storyId === "number" && Number.isInteger(body.storyId) ? body.storyId : undefined;
    return Response.json(await generateScript({ storyId }));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
