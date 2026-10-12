import { after } from "next/server";
import { runResearch } from "@/lib/research/engine";
import { createResearch, listResearch } from "@/lib/research/store";
import { DEPTHS, TIME_RANGES, type Depth, type TimeRange } from "@/lib/research/types";

export async function GET() {
  return Response.json({ research: listResearch() });
}

/** Body { topic, timeRange, depth }. Starts the research in the background and returns its id at once. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { topic?: string; timeRange?: string; depth?: string };
  const topic = (body.topic ?? "").trim().replace(/\s+/g, " ");
  if (topic.length < 3 || topic.length > 300) return Response.json({ error: "Enter a topic (3 to 300 characters) or a link" }, { status: 400 });
  const timeRange: TimeRange = body.timeRange && body.timeRange in TIME_RANGES ? (body.timeRange as TimeRange) : "week";
  const depth: Depth = body.depth && body.depth in DEPTHS ? (body.depth as Depth) : "deep";

  const id = createResearch(topic, timeRange, depth);
  // Takes 30s to 3 min; the page polls GET /api/research/:id for progress.
  after(() => runResearch(id));
  return Response.json({ id });
}
