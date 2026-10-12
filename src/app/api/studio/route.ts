import { after } from "next/server";
import { getScript } from "@/lib/scripts/store";
import { runVideo } from "@/lib/studio/engine";
import { getProject, listProjects } from "@/lib/studio/store";

export async function GET() {
  return Response.json({ projects: listProjects() });
}

/** Body { scriptId }: make the voice and find footage for every line (1-3 min, in the background). */
export async function POST(req: Request) {
  const { scriptId } = (await req.json().catch(() => ({}))) as { scriptId?: number };
  const script = typeof scriptId === "number" ? getScript(scriptId) : null;
  if (!script?.content) return Response.json({ error: "Pick a finished script" }, { status: 400 });
  const p = getProject(script.id);
  if (p && (p.status === "running" || p.status === "rendering")) return Response.json({ error: "This video is already being made" }, { status: 409 });
  after(() => runVideo(script.id));
  return Response.json({ scriptId: script.id });
}
