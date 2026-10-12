import { after } from "next/server";
import { getResearch } from "@/lib/research/store";
import { DEPTHS, TIME_RANGES, type Depth, type TimeRange } from "@/lib/research/types";
import { runScript } from "@/lib/scripts/engine";
import { createScript, listScripts } from "@/lib/scripts/store";

export async function GET() {
  return Response.json({ scripts: listScripts() });
}

/**
 * { researchId } writes a script from a finished research.
 * { topic, timeRange, depth } runs research first, then writes the script.
 * Runs in the background; poll GET /api/scripts/:id.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { researchId?: number; topic?: string; timeRange?: string; depth?: string };

  if (typeof body.researchId === "number") {
    const research = getResearch(body.researchId);
    if (!research?.result) return Response.json({ error: "That research is not finished" }, { status: 400 });
    const id = createScript(research.result.title, research.id, false);
    after(() => runScript(id, { researchId: research.id }));
    return Response.json({ id });
  }

  const topic = (body.topic ?? "").trim().replace(/\s+/g, " ");
  if (topic.length < 3 || topic.length > 300) return Response.json({ error: "Enter a topic (3 to 300 characters) or a link" }, { status: 400 });
  const timeRange: TimeRange = body.timeRange && body.timeRange in TIME_RANGES ? (body.timeRange as TimeRange) : "week";
  const depth: Depth = body.depth && body.depth in DEPTHS ? (body.depth as Depth) : "quick";
  const id = createScript(topic, null, true);
  after(() => runScript(id, { topic, timeRange, depth }));
  return Response.json({ id });
}
