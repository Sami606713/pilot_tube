import { type NextRequest } from "next/server";
import { parseResearchParams, research } from "@/lib/news/research";

/** Search saved + live AI news. Query: q, range (today|week|month), source, sort (newest|popular), status. */
export async function GET(req: NextRequest) {
  try {
    return Response.json(await research(parseResearchParams(req.nextUrl.searchParams)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
