import { z } from "zod";
import { deleteScript, getScript, saveScriptContent } from "@/lib/scripts/store";
import { TRANSITIONS, UNCHECKED, VISUALS, type Transition, type VisualType } from "@/lib/scripts/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/scripts/[id]">) {
  const script = getScript(Number((await ctx.params).id));
  if (!script) return Response.json({ error: "Script not found" }, { status: 404 });
  return Response.json(script);
}

const editSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(4500),
  hashtags: z.array(z.string().min(2)).max(10),
  lines: z.array(
    z.object({
      narration: z.string().min(1),
      visual: z.object({ type: z.enum(Object.keys(VISUALS) as [VisualType, ...VisualType[]]), description: z.string() }),
      onScreenText: z.string(),
      transition: z.enum(Object.keys(TRANSITIONS) as [Transition, ...Transition[]]),
      sfx: z.string(),
    }),
  ),
});

/** Save hand edits. Lines whose narration changed are marked as not re-checked. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/scripts/[id]">) {
  const script = getScript(Number((await ctx.params).id));
  if (!script?.content) return Response.json({ error: "Script not found" }, { status: 404 });
  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid edit" }, { status: 400 });
  const edit = parsed.data;
  if (edit.lines.length !== script.content.lines.length) return Response.json({ error: "Lines can be edited, not added or removed" }, { status: 400 });

  const lines = script.content.lines.map((old, i) => {
    const next = edit.lines[i];
    const changed = next.narration.trim() !== old.narration.trim();
    return { ...old, ...next, narration: next.narration.trim(), check: changed ? { ok: true, note: UNCHECKED } : old.check };
  });
  saveScriptContent(script.id, { ...script.content, title: edit.title, description: edit.description, hashtags: edit.hashtags, lines, edited: true });
  return Response.json(getScript(script.id));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/scripts/[id]">) {
  deleteScript(Number((await ctx.params).id));
  return Response.json({ ok: true });
}
