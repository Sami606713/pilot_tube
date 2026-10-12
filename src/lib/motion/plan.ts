import "server-only";
import { z } from "zod";
import { agnes } from "@/lib/agnes";
import { env } from "@/lib/env";
import { wordCount, type ShortScript } from "@/lib/script/schema";

/** One animated screen per script line. Every field comes from the script's own words. */
export const beatSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("keyword"), text: z.string().min(1).max(40), sub: z.string().max(70).optional() }),
  z.object({ type: z.literal("number"), value: z.string().min(1).max(12), label: z.string().min(1).max(50) }),
  z.object({ type: z.literal("quote"), text: z.string().min(1).max(120), source: z.string().max(40).optional() }),
  z.object({ type: z.literal("vs"), left: z.string().min(1).max(24), right: z.string().min(1).max(24), note: z.string().max(60).optional() }),
  z.object({ type: z.literal("timeline"), steps: z.array(z.string().min(1).max(32)).min(2).max(4) }),
  z.object({ type: z.literal("list"), title: z.string().min(1).max(40), items: z.array(z.string().min(1).max(40)).min(2).max(4) }),
  z.object({ type: z.literal("statement"), text: z.string().min(1).max(90), highlight: z.string().max(30).optional() }),
  z.object({ type: z.literal("question"), text: z.string().min(1).max(90) }),
  // Added by PilotTube at the end (never asked of Agnes): follow call with a subscribe-button press.
  z.object({ type: z.literal("outro"), text: z.string().min(1).max(60) }),
]);
export type Beat = z.infer<typeof beatSchema>;
export type TimedBeat = Beat & { scene: number; start: number; duration: number; line: string };

const planSchema = z.object({ beats: z.array(z.unknown()) });

/** The word to put in the marker box: a number if there is one, otherwise the longest word. */
function keyWord(text: string): string {
  const words = text.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}$%]/gu, "")).filter(Boolean);
  return words.find((w) => /\d/.test(w)) ?? words.reduce((a, b) => (b.length > a.length ? b : a), "");
}

/** Fallback screen: the line itself, shortened to 8 words, with a key word highlighted. */
function statementFor(line: string): Beat {
  const text = line.split(/\s+/).filter(Boolean).slice(0, 8).join(" ").slice(0, 90);
  return { type: "statement", text, highlight: keyWord(text) };
}

/** Field names Agnes sometimes uses instead of ours, mapped back before validation. */
const ALIASES: Record<string, string> = {
  word: "text", phrase: "text", headline: "text", statement: "text", quote: "text", question: "text",
  quantity: "value", number: "value", amount: "value", stat: "value",
  measure: "label", description: "label", caption: "label", unit: "label",
  speaker: "source", author: "source", by: "source",
  a: "left", b: "right", sideA: "left", sideB: "right", subtitle: "sub", subline: "sub",
  events: "steps", points: "items", bullets: "items", heading: "title", emphasis: "highlight",
};

function normalizeBeat(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k === "type" ? k : (ALIASES[k] ?? k);
    if (!(key in out)) out[key] = v;
  }
  // "keyword" is the main text on a keyword screen but the highlight on a statement.
  if (typeof out.keyword === "string") {
    if (out.type === "keyword" && out.text === undefined) out.text = out.keyword;
    else if (out.type === "statement" && out.highlight === undefined) out.highlight = out.keyword;
    delete out.keyword;
  }
  return out;
}

/** Statements always get a highlighted word, so no screen is a flat wall of text. */
function withHighlight(beat: Beat): Beat {
  return beat.type === "statement" && !beat.highlight ? { ...beat, highlight: keyWord(beat.text) } : beat;
}

// Reading pace for timing when there is no voiceover: ~2.5 words per second, at least 2.4s per screen.
const WORDS_PER_SECOND = 2.5;
const MIN_SECONDS = 2.4;
const OUTRO_SECONDS = 3.2;
// Shorts in this channel are at most 60 seconds.
const MAX_TOTAL_SECONDS = 60;

const SYSTEM_PROMPT = `You turn a YouTube Short script about AI news into a motion graphics plan: ONE animated screen per script line.
Pick the type that shows each line best, and fill it ONLY with words, names and numbers from that line (never invent):
- {"type":"keyword","text":"max 3 words","sub":"optional short line"}: one huge word or phrase for a strong single idea.
- {"type":"number","value":"$50B","label":"what it measures"}: a striking quantity from the line ("$50B", "40%", "2 months").
- {"type":"quote","text":"max 15 words","source":"who said it"}: a statement someone made.
- {"type":"vs","left":"side A","right":"side B","note":"optional short note"}: two sides facing off (people, companies, ideas).
- {"type":"timeline","steps":["step 1","step 2"]}: 2-4 short steps in time order when the line describes a sequence.
- {"type":"list","title":"short title","items":["item 1","item 2"]}: 2-4 short items when the line lists things.
- {"type":"statement","text":"max 8 punchy words","highlight":"one word from text"}: the line shortened; always give the highlight.
- {"type":"question","text":"the question"}: for the final question to viewers.
Use EXACTLY these field names.
Variety matters: use "statement" for at most 2 lines in the whole plan, never the same type twice in a row, and prefer keyword, number, vs, list and timeline whenever the line allows. Keep every text short: it must read in 2-3 seconds.
Reply with ONLY JSON: {"beats":[ ... one object per line, in order, each with "type" and its fields ... ]}`;

async function askPlan(script: ShortScript): Promise<Beat[]> {
  const lines = script.scenes.map((s, i) => `${i + 1}. ${s.narration}`).join("\n");
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Headline: ${script.cards.hook}\nScript lines:\n${lines}\n\nReturn exactly ${script.scenes.length} beats.` },
  ];
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await agnes().chat.completions.create({ model: env().AGNES_MODEL, temperature: 0.6, messages });
    const text = res.choices[0]?.message?.content ?? "";
    try {
      const { beats } = planSchema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
      // Check each screen on its own: one bad screen becomes a plain statement instead of failing the plan,
      // and a wrong count is padded or trimmed to one screen per line.
      return script.scenes.map((scene, i) => {
        const parsed = beatSchema.safeParse(normalizeBeat(beats[i]));
        if (!parsed.success) console.warn(`[motion] screen ${i + 1} replaced by a statement:`, JSON.stringify(beats[i]).slice(0, 200), parsed.error.issues[0]?.message);
        return parsed.success && parsed.data.type !== "outro" ? withHighlight(parsed.data) : statementFor(scene.narration);
      });
    } catch (err) {
      lastError = (err as Error).message.slice(0, 200);
      messages.push({ role: "assistant", content: text }, { role: "user", content: `That was invalid: ${lastError}. Reply again with only the corrected JSON.` });
    }
  }
  throw new Error(`Agnes could not plan the motion graphics: ${lastError}`);
}

/** Plan the whole script as motion graphics, timed by reading pace, plus a short outro screen. */
export async function planMotion(script: ShortScript): Promise<{ beats: TimedBeat[]; duration: number }> {
  const beats = await askPlan(script);
  const natural = beats.map((_, i) => Math.max(MIN_SECONDS, wordCount(script.scenes[i].narration) / WORDS_PER_SECOND));
  // If the script would run past 60s, shorten every screen by the same factor so it fits.
  const budget = MAX_TOTAL_SECONDS - OUTRO_SECONDS;
  const sum = natural.reduce((a, b) => a + b, 0);
  const factor = sum > budget ? budget / sum : 1;
  let t = 0;
  const timed: TimedBeat[] = beats.map((beat, i) => {
    const line = script.scenes[i].narration;
    const duration = Math.floor(natural[i] * factor * 10) / 10;
    const item = { ...beat, scene: i, start: t, duration, line };
    t += duration;
    return item;
  });
  timed.push({ type: "outro", text: script.cards.outro.slice(0, 60), scene: -1, start: t, duration: OUTRO_SECONDS, line: script.cards.outro });
  return { beats: timed, duration: Math.round((t + OUTRO_SECONDS) * 10) / 10 };
}
