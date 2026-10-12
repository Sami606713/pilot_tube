import "server-only";
import { z } from "zod";
import { askJson } from "@/lib/agnes";
import type { ScriptLine } from "@/lib/scripts/types";
import { SCENES, type Chart, type LineMode, type Scene3D } from "./types";

const SCENE_KEYS = Object.keys(SCENES) as [Scene3D, ...Scene3D[]];

const planSchema = z.object({
  mainCompany: z.object({ name: z.string(), domain: z.string() }).nullable().catch(null),
  lines: z.array(
    z.object({
      scene: z.enum(SCENE_KEYS).catch("particles"),
      company: z.object({ name: z.string(), domain: z.string() }).nullable().catch(null),
      chart: z
        .union([
          z.object({ kind: z.literal("counter"), value: z.number(), decimals: z.number().int().min(0).max(2).catch(0), prefix: z.string().catch(""), suffix: z.string().catch(""), label: z.string().catch("") }),
          z.object({ kind: z.literal("bars"), items: z.array(z.object({ label: z.string(), value: z.number() })).min(2).max(4), suffix: z.string().catch(""), label: z.string().catch("") }),
        ])
        .nullable()
        .catch(null),
      phrases: z.array(z.string()).max(3).catch([]),
    }),
  ),
});

export type DesignPlan = {
  mainCompany: { name: string; domain: string } | null;
  lines: { scene: Scene3D; company: { name: string; domain: string } | null; chart: Chart | null; phrases: string[] }[];
};

const PROMPT = `You are the motion designer of a premium AI-news YouTube Short. For each script line, prepare designs the editor can use.

Return ONLY JSON:
{
  "mainCompany": { "name": "Microsoft", "domain": "microsoft.com" },     // the story's main company/lab (null if none)
  "lines": [
    {
      "scene": "chip",           // best 3D scene: ${SCENE_KEYS.map((k) => `"${k}" (${SCENES[k]})`).join(", ")}
      "company": { "name": "Nvidia", "domain": "nvidia.com" },   // company this line is mainly about, if any, with its real website domain (else null)
      "chart": { "kind": "counter", "value": 40, "decimals": 0, "prefix": "", "suffix": "%", "label": "more tokens per megawatt" },
      "phrases": ["40% MORE", "PER MEGAWATT"]
    }
  ]
}

Rules:
- One entry per line, in order.
- "chart": ONLY when the line itself states a number. Use exactly that number (no invented or rounded numbers). "counter" for one number; "bars" (2-4 items) only when the line compares numbers it states. Otherwise null.
- "phrases": 1-3 punchy kinetic-text phrases (1-3 words each, UPPERCASE) taken from the line's own words.
- Real company domains only (openai.com, nvidia.com, microsoft.com, google.com, anthropic.com, meta.com, apple.com, amazon.com, tsmc.com...).`;

/** A chart number must be spoken or shown in the line: no invented data on screen. */
function numberAppears(value: number, text: string): boolean {
  const plain = text.replace(/,/g, "");
  const variants = [String(value), value.toFixed(1), value.toFixed(2)].map((v) => v.replace(/\.0+$/, ""));
  return variants.some((v) => new RegExp(`(^|[^\\d.])${v.replace(".", "\\.")}([^\\d]|$)`).test(plain));
}

const WORD_NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20, hundred: 100 };

function lineMentions(value: number, line: Pick<ScriptLine, "narration" | "onScreenText">): boolean {
  const text = `${line.narration} ${line.onScreenText}`;
  if (numberAppears(value, text)) return true;
  return Object.entries(WORD_NUMBERS).some(([w, n]) => n === value && new RegExp(`\\b${w}\\b`, "i").test(text));
}

export async function planDesign(title: string, lines: ScriptLine[]): Promise<DesignPlan> {
  const list = lines.map((l, i) => `${i + 1}. "${l.narration}" | on-screen: "${l.onScreenText}" | wants: ${l.visual.type}: ${l.visual.description}`).join("\n");
  const plan = await askJson(PROMPT, `Title: ${title}\n\nLines:\n${list}`, (raw) => {
    const p = planSchema.parse(raw);
    if (p.lines.length !== lines.length) throw new Error(`Need exactly ${lines.length} line entries, got ${p.lines.length}`);
    return p;
  });
  return {
    mainCompany: plan.mainCompany,
    lines: plan.lines.map((d, i) => {
      let chart: Chart | null = d.chart;
      if (chart?.kind === "counter" && !lineMentions(chart.value, lines[i])) chart = null;
      if (chart?.kind === "bars" && !chart.items.every((it) => lineMentions(it.value, lines[i]))) chart = null;
      const phrases = d.phrases.map((p) => p.trim().toUpperCase()).filter((p) => p && p.split(/\s+/).length <= 4);
      return { scene: d.scene, company: d.company, chart, phrases: phrases.length ? phrases : [lines[i].onScreenText.toUpperCase()].filter(Boolean) };
    }),
  };
}

/** The script's planned visual decides the starting mode; anything the design can't support falls back to footage. */
export function startMode(planned: ScriptLine["visual"]["type"], hasChart: boolean, hasLogo: boolean): LineMode {
  switch (planned) {
    case "3d-motion":
      return "3d";
    case "chart":
      return hasChart ? "chart" : "text";
    case "logo":
      return hasLogo ? "logo" : "3d";
    case "kinetic-text":
      return "text";
    default:
      return "footage";
  }
}
