import "server-only";
import { z } from "zod";
import { askJson } from "@/lib/agnes";
import { runResearch } from "@/lib/research/engine";
import { createResearch, getResearch } from "@/lib/research/store";
import type { Depth, FactGroup, ResearchResult, TimeRange } from "@/lib/research/types";
import { failScript, getScript, saveScriptContent, setResearchId, touchScript, updateScriptStep } from "./store";
import {
  PARTS,
  TRANSITIONS,
  VISUALS,
  WORD_LIMIT,
  WORD_TARGET,
  seconds,
  totalWords,
  wordCount,
  type Hook,
  type Part,
  type ScriptContent,
  type ScriptLine,
  type ScriptScores,
  type ScriptStepKey,
  type Transition,
  type VisualType,
  UNCHECKED,
} from "./types";

// ---------- Facts the script may use ----------

/**
 * Confirmed facts are stated plainly; single-source facts must be attributed; conflicts are left out
 * (the user's rule: "confirmed + attributed").
 */
function factSheet(r: ResearchResult): { text: string; usable: FactGroup[] } {
  const domain = (n: number) => r.sources.find((s) => s.n === n)?.domain ?? "a source";
  const usable = r.facts.filter((f) => f.status !== "conflict");
  const text = usable
    .map((f) =>
      f.status === "confirmed"
        ? `${f.id} [CONFIRMED] ${f.statement}`
        : `${f.id} [SINGLE SOURCE: must say "according to ${domain(f.sources[0])}"] ${f.statement}`,
    )
    .join("\n");
  return { text, usable };
}

function researchBrief(r: ResearchResult): string {
  const p = r.report;
  return [`Topic: ${r.title}`, `Summary: ${p.summary}`, `Why it matters: ${p.whyItMatters}`, `Background: ${p.background}`, `What's next: ${p.whatsNext}`]
    .join("\n")
    .replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "");
}

// ---------- 1. Hooks ----------

const hooksSchema = z.object({
  hooks: z
    .array(z.object({ text: z.string().min(8), style: z.enum(["number", "claim", "question"]).catch("claim"), score: z.number().min(0).max(10).catch(5), why: z.string().default("") }))
    .length(3),
  best: z.number().int().min(0).max(2),
});

const HOOKS_PROMPT = `You write scroll-stopping hooks for a dramatic, storytelling YouTube Shorts channel about AI news. The hook is the first 2-3 seconds (6-14 words) and decides if people keep watching.

Write exactly 3 hooks, one of each style:
- "number": lead with the most shocking TRUE number
- "claim": a bold, dramatic but TRUE claim or conflict
- "question": a question that creates curiosity

Score each 0-10 (stopping power, clarity, curiosity, truthfulness) and pick the best.
Use ONLY the facts given. A single-source fact cannot be the hook unless attributed. Dramatic but LITERALLY TRUE: no "killing", "destroying", "ending", "the best", "all" or other claims the facts don't state (a company "reducing reliance" on a rival is not "killing" it). No emojis.

Return ONLY JSON: { "hooks": [ { "text": "...", "style": "number", "score": 8, "why": "short reason" } ], "best": 0 }`;

// ---------- 2. Script ----------

const VISUAL_KEYS = Object.keys(VISUALS) as [VisualType, ...VisualType[]];
const TRANSITION_KEYS = Object.keys(TRANSITIONS) as [Transition, ...Transition[]];
const PART_KEYS = Object.keys(PARTS) as [Part, ...Part[]];

const lineSchema = z.object({
  part: z.enum(PART_KEYS),
  narration: z.string().min(3),
  visual: z.object({ type: z.enum(VISUAL_KEYS).catch("3d-motion"), description: z.string().min(3) }),
  onScreenText: z.string().default(""),
  transition: z.enum(TRANSITION_KEYS).catch("cut"),
  sfx: z.string().default(""),
  facts: z.array(z.string()).default([]),
});
type DraftLine = z.infer<typeof lineSchema>;

const scriptSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20),
  hashtags: z.array(z.string()).min(3).max(8),
  lines: z.array(lineSchema).min(8).max(13),
});

const SCRIPT_PROMPT = `You are the head writer and video director of a premium AI-news YouTube Shorts channel. Write ONE dramatic, storytelling script that an editor can cut directly into a professional Short with 3D motion graphics, B-roll, kinetic text, transitions and sound design.

STORY STRUCTURE (in this order, 9-12 lines total):
1. hook (1 line, 0-3s): use the given hook exactly as line 1.
2. setup (2 lines): what happened, who is involved.
3. tension (2 lines): the stakes, the rivalry, the problem.
4. reveal (2-3 lines): the key numbers and facts that pay it off.
5. why (1-2 lines): why it matters to people and the industry.
6. loop (1 line): the final line must flow straight back into the hook so the Short replays seamlessly: it ends on a half-finished thought that line 1 completes (e.g. last line "...and that's exactly why" → line 1). NEVER repeat the hook's words. No "follow for more".

LENGTH: ${WORD_TARGET.min}-${WORD_TARGET.max} words of narration in total (50-58 seconds); aim for about 132. Lines of 8-18 words. Short, punchy sentences.
TONE: dramatic storytelling: build real tension (stakes, rivalry, contrast, "but"), then pay it off with the numbers; simple English a 14-year-old understands. No hype words like "revolutionary", "game-changing", "insane".

FACTS: use ONLY the facts given. Keep the facts' exact qualifiers (e.g. "than leading GPU-based systems", "expected", "up to") and never add superlatives or absolutes ("unmatched", "the fastest", "all", "killing") that the facts don't state. CONFIRMED facts can be said plainly. SINGLE SOURCE facts must be attributed in the narration ("according to cnbc.com" said naturally, e.g. "CNBC reports..."). Never invent numbers, names or dates. Each line lists the fact ids it uses in "facts" (empty only for pure story lines like the loop).

FOR EVERY LINE also direct the edit:
- "visual": { "type": one of ${VISUAL_KEYS.join(", ")}, "description": what is on screen, concrete and cinematic (camera move, objects, colors). Prefer 3d-motion for abstract ideas, b-roll for real places/products, chart for numbers, logo for companies. Vary the types. }
- "onScreenText": 1-4 BIG words or the key number shown as kinetic text (e.g. "40% MORE"), or "" if none
- "transition": transition INTO the next line, one of ${TRANSITION_KEYS.join(", ")} (vary them; strongest ones on the reveal)
- "sfx": short sound cue (e.g. "deep impact", "whoosh", "riser", "glitch hit", "click"), or ""

ALSO: "title" (max 70 characters, curiosity + main keyword, no clickbait lies), "description" (2-3 sentences summarizing the story), "hashtags" (4-6, including #Shorts and #AI).

Return ONLY this JSON:
{ "title": "", "description": "", "hashtags": ["#Shorts"], "lines": [ { "part": "hook", "narration": "", "visual": { "type": "3d-motion", "description": "" }, "onScreenText": "", "transition": "zoom-punch", "sfx": "", "facts": ["G1"] } ] }`;

/** Length and structure rules, with feedback precise enough for Agnes to fix them. */
function validateScript(raw: unknown, hook: string, factIds: Set<string>) {
  const script = scriptSchema.parse(raw);
  const problems: string[] = [];
  const words = totalWords(script.lines);
  if (words < WORD_LIMIT.min || words > WORD_LIMIT.max) {
    const counts = script.lines.map((l, i) => `line ${i + 1}: ${wordCount(l.narration)}`).join(", ");
    problems.push(
      `The narration has ${words} words; it must be ${WORD_TARGET.min}-${WORD_TARGET.max}. ${words < WORD_LIMIT.min ? "Add" : "Cut"} about ${Math.abs(words - (WORD_TARGET.min + WORD_TARGET.max) / 2)} words. Words per line: ${counts}.`,
    );
  }
  if (script.lines[0].part !== "hook") problems.push(`Line 1 must be the hook.`);
  if (script.lines[script.lines.length - 1].part !== "loop") problems.push(`The last line must have part "loop".`);
  const firstWords = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).slice(0, 4).join(" ");
  if (firstWords(script.lines[0].narration) !== firstWords(hook)) problems.push(`Line 1 narration must be exactly the given hook: "${hook}".`);
  const unknown = [...new Set(script.lines.flatMap((l) => l.facts).filter((f) => !factIds.has(f)))];
  if (unknown.length) problems.push(`Unknown fact ids ${unknown.join(", ")}: use only the ids given.`);
  if (problems.length) throw new Error(problems.join(" "));
  return script;
}

// ---------- 3. Review: fact check + scores ----------

const reviewSchema = z.object({
  lines: z.array(z.object({ line: z.number().int(), ok: z.boolean(), problem: z.string().optional() })),
  scores: z.object({
    hook: z.number().min(0).max(10),
    story: z.number().min(0).max(10),
    accuracy: z.number().min(0).max(10),
    pacing: z.number().min(0).max(10),
    loop: z.number().min(0).max(10),
  }),
  notes: z.array(z.string()).max(5).default([]),
});

const REVIEW_PROMPT = `You are a strict fact-checker and Shorts editor. Check a script against the research facts.

For EVERY narration line: "ok": true only if every factual claim in it is supported by the listed facts (story/transition phrasing with no factual claim is ok). Single-source facts must be attributed. Flag invented numbers, wrong numbers, exaggeration beyond the facts, and missing attribution, with a short "problem".

Then score the script 0-10: hook (stops the scroll?), story (setup → tension → reveal → payoff?), accuracy, pacing (punchy, no filler?), loop (does the last line flow back into line 1?). Add up to 5 short improvement notes.

Return ONLY JSON: { "lines": [ { "line": 1, "ok": true, "problem": "" } ], "scores": { "hook": 8, "story": 7, "accuracy": 9, "pacing": 8, "loop": 6 }, "notes": [""] }`;

const fixSchema = z.object({ lines: z.array(z.object({ line: z.number().int(), narration: z.string().min(3), facts: z.array(z.string()).default([]) })) });

const FIX_PROMPT = `Rewrite ONLY the listed script lines so every claim is supported by the facts (attribute single-source facts, keep the facts' exact qualifiers, no unsupported superlatives). Keep each line's role in the story, its dramatic tone, and about the same number of words (±2). If line 1 (the hook) is listed, keep it short and scroll-stopping but true. Return ONLY JSON: { "lines": [ { "line": 3, "narration": "...", "facts": ["G2"] } ] }`;

const numbered = (lines: Pick<ScriptLine, "narration" | "part" | "facts">[]) =>
  lines.map((l, i) => `${i + 1}. (${l.part}) ${l.narration}  [facts: ${l.facts.join(", ") || "none"}]`).join("\n");

async function review(lines: ScriptLine[], facts: string) {
  return askJson(REVIEW_PROMPT, `Research facts:\n${facts}\n\nScript:\n${numbered(lines)}`, (r) => reviewSchema.parse(r), { temperature: 0 });
}

function scoresFrom(r: z.infer<typeof reviewSchema>): ScriptScores {
  const s = r.scores;
  // Accuracy and the hook count double: a wrong fact or weak opening sinks a Short.
  const overall = Math.round(((s.hook * 2 + s.story + s.accuracy * 2 + s.pacing + s.loop) / 7) * 10) / 10;
  return { ...s, overall, notes: r.notes };
}

/** Description = Agnes's summary + the sources the script actually used (real links build trust). */
function withSources(description: string, lines: ScriptLine[], r: ResearchResult): string {
  const used = new Set(lines.flatMap((l) => l.facts));
  const nums = [...new Set(r.facts.filter((f) => used.has(f.id)).flatMap((f) => f.sources))];
  const ranked = nums
    .map((n) => r.sources.find((s) => s.n === n)!)
    .filter(Boolean)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "official" ? -1 : b.kind === "official" ? 1 : a.kind === "news" ? -1 : 1))
    .slice(0, 4);
  return ranked.length ? `${description.trim()}\n\nSources:\n${ranked.map((s) => `${s.title} (${s.domain}): ${s.url}`).join("\n")}` : description.trim();
}

// ---------- Run ----------

export type ScriptRequest = { researchId: number } | { topic: string; timeRange: TimeRange; depth: Depth };

export async function runScript(id: number, request: ScriptRequest): Promise<void> {
  let current: ScriptStepKey = "research";
  const step = (key: ScriptStepKey, detail?: string) => {
    current = key;
    updateScriptStep(id, key, "running", detail);
  };
  const done = (key: ScriptStepKey, detail: string) => updateScriptStep(id, key, "done", detail);

  try {
    // 0. Research (custom topic) or reuse a finished one
    let researchId: number;
    if ("topic" in request) {
      step("research", "Running research first (2-6 min)");
      researchId = createResearch(request.topic, request.timeRange, request.depth);
      setResearchId(id, researchId);
      const keepAlive = setInterval(() => touchScript(id), 60_000);
      try {
        await runResearch(researchId);
      } finally {
        clearInterval(keepAlive);
      }
    } else {
      researchId = request.researchId;
    }
    const research = getResearch(researchId);
    if (!research?.result) throw new Error(research?.error ? `Research failed: ${research.error}` : "The research is not finished");
    const r = research.result;
    if ("topic" in request) done("research", `${r.score.value}/100 ${r.score.label} evidence · ${r.facts.length} facts`);

    const { text: facts, usable } = factSheet(r);
    if (usable.length < 4) throw new Error("The research has too few usable facts for a 55-second script. Try a Deep research or another topic.");
    const brief = researchBrief(r);
    const factIds = new Set(usable.map((f) => f.id));

    // 1. Hooks
    step("hooks");
    const h = await askJson(HOOKS_PROMPT, `${brief}\n\nFacts:\n${facts}`, (raw) => hooksSchema.parse(raw), { temperature: 0.8 });
    const hooks: Hook[] = h.hooks;
    const hook = hooks[h.best].text;
    done("hooks", `Best (${hooks[h.best].style}, ${hooks[h.best].score}/10): "${hook}"`);

    // 2. Script (length problems go back to Agnes with per-line word counts)
    step("write");
    const draft = await askJson(
      SCRIPT_PROMPT,
      `${brief}\n\nHook (line 1, word for word): "${hook}"\n\nFacts:\n${facts}`,
      (raw) => validateScript(raw, hook, factIds),
      { temperature: 0.7, attempts: 4 },
    );
    let lines: ScriptLine[] = draft.lines.map((l: DraftLine) => ({ ...l, check: { ok: true } }));
    done("write", `${lines.length} lines · ${totalWords(lines)} words · ~${seconds(totalWords(lines))}s`);

    // 3. Fact check; unsupported lines (the hook too) are rewritten and checked again, up to 2 rounds
    step("check");
    let rev = await review(lines, facts);
    let fixedCount = 0;
    for (let round = 0; round < 2; round++) {
      const bad = rev.lines.filter((x) => !x.ok && x.line >= 1 && x.line <= lines.length);
      if (bad.length === 0) break;
      updateScriptStep(id, "check", "running", `Round ${round + 1}: fixing ${bad.length} line${bad.length > 1 ? "s" : ""}`);
      const fix = await askJson(
        FIX_PROMPT,
        `Facts:\n${facts}\n\nScript:\n${numbered(lines)}\n\nFix these lines:\n${bad.map((b) => `${b.line}: ${b.problem ?? "unsupported claim"}`).join("\n")}`,
        (raw) => fixSchema.parse(raw),
        { temperature: 0.4 },
      );
      for (const f of fix.lines) {
        const i = f.line - 1;
        if (!lines[i]) continue;
        lines[i] = { ...lines[i], narration: f.narration, facts: f.facts.filter((x) => factIds.has(x)) };
        fixedCount++;
      }
      rev = await review(lines, facts);
    }
    lines = lines.map((l, i) => {
      const verdict = rev.lines.find((x) => x.line === i + 1);
      return { ...l, check: verdict && !verdict.ok ? { ok: false, note: verdict.problem || "Not supported by the research" } : { ok: true } };
    });
    const flagged = lines.filter((l) => !l.check.ok).length;
    done("check", `${lines.length - flagged} of ${lines.length} lines supported${fixedCount ? ` · ${fixedCount} rewritten` : ""}${flagged ? ` · ${flagged} still flagged` : ""}`);

    // 4. Finish
    step("finish");
    const scores = scoresFrom(rev);
    const hashtags = [...new Set(["#Shorts", ...draft.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`).replace(/\s+/g, ""))])].slice(0, 6);
    const content: ScriptContent = {
      title: draft.title,
      description: withSources(draft.description, lines, r),
      hashtags,
      // The fact check may have corrected the hook; keep the list in sync with line 1.
      hooks: hooks.map((x, i) => (i === h.best ? { ...x, text: lines[0].narration } : x)),
      chosenHook: h.best,
      lines,
      scores,
      edited: false,
    };
    done("finish", `Score ${scores.overall}/10 · ${seconds(totalWords(lines))}s`);
    saveScriptContent(id, content);
  } catch (err) {
    console.error(`[script] #${id} failed at ${current}:`, err);
    failScript(id, (err as Error).message);
  }
}

// ---------- Single-line rewrite ----------

const LINE_PROMPT = `Rewrite ONE line of a dramatic AI-news Shorts script. Keep its story role, keep it true to the facts (attribute single-source facts), keep about the same number of words (±3) unless the instruction says otherwise. Also update its edit cues if needed.
Return ONLY JSON: { "narration": "", "visual": { "type": "3d-motion", "description": "" }, "onScreenText": "", "transition": "cut", "sfx": "", "facts": ["G1"] }`;

export async function rewriteLine(scriptId: number, index: number, instruction: string): Promise<void> {
  const script = getScript(scriptId);
  if (!script?.content || !script.researchId) throw new Error("Script not found");
  const research = getResearch(script.researchId);
  if (!research?.result) throw new Error("The research for this script is missing");
  const { text: facts, usable } = factSheet(research.result);
  const factIds = new Set(usable.map((f) => f.id));
  const lines = script.content.lines;
  if (!lines[index]) throw new Error("No such line");

  const out = await askJson(
    LINE_PROMPT,
    `Facts:\n${facts}\n\nWhole script:\n${numbered(lines)}\n\nRewrite line ${index + 1} (${lines[index].part}).${instruction ? ` Instruction: ${instruction}` : ""}`,
    (raw) => lineSchema.omit({ part: true }).parse(raw),
    { temperature: 0.7 },
  );
  lines[index] = { ...lines[index], ...out, facts: out.facts.filter((f) => factIds.has(f)), check: { ok: true, note: UNCHECKED } };
  saveScriptContent(scriptId, { ...script.content, lines, edited: true });
}
