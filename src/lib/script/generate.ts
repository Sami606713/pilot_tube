import "server-only";
import { z } from "zod";
import { agnes } from "@/lib/agnes";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchArticleText } from "@/lib/news/article";
import { markStorySkipped, markStoryUsed, recentlyUsedTitles, refreshNews, unusedStories, type StoryRow } from "@/lib/news/store";
import { fullNarration, shortScriptSchema, wordCount, type ShortScript } from "./schema";

// ~2.5 words per second of speech → 30–45 second Short.
const MIN_WORDS = 70;
const MAX_WORDS = 120;
// Below this we can't verify facts (paywall, bot block), so the story is skipped instead of guessed at.
const MIN_ARTICLE_CHARS = 800;
const MAX_STORY_PICKS = 4;

const PICK_PROMPT = `You are the editor of a YouTube Shorts channel about AI news.
Pick the ONE story most likely to make viewers stop scrolling: big launches, surprising numbers, major company moves, wild AI incidents.
Skip opinion pieces, tutorials, event promos, minor updates, non-AI stories, and anything similar to the "already covered" list.
Reply with ONLY JSON: {"storyIndex": number, "reason": string}`;

const WRITE_PROMPT = `You write scripts for a YouTube Shorts channel about AI news.
The audience is curious people and developers who want the latest AI news in under a minute.

Rules:
- FACTS: use ONLY facts stated in the article text given. Never invent dates, numbers, names, quotes or events.
  If a detail is not in the article, leave it out.
- LENGTH: total narration MUST be ${MIN_WORDS}-${MAX_WORDS} words (30-45 seconds when spoken).
  Write 6-8 scenes of 12-16 words each. Count your words before replying.
- Scene 1 is the hook: under 12 words, bold and specific. Never start with "Hey guys" or "In today's video".
- Middle scenes: the key facts in simple words and short sentences, one idea per scene.
- Last scene: a one-line takeaway, then a question for the comments.
- Each scene gets a 2-4 word "pexelsQuery" for generic stock footage (e.g. "server room lights", "person typing laptop", "robot arm factory").
  No brand names or people's names, since stock sites don't have them.
- title: under 70 characters, catchy but honest, no hashtags.
- description: 2-3 sentences, then "Source: <source name>".
- hashtags: 3-6 tags, always include "#Shorts" and "#AI".
- cards.hook: big on-screen headline, 4-8 words, a full punchy phrase with a verb (e.g. "Nvidia wants to buy an AI lab").
  Not a label like "7.5B AI Model Jev".
- cards.stats: 0-3 striking quantities from the article: money, percentages, counts, multipliers ("$870M", "40%", "10x", "2 million").
  value is the number only (max ~6 characters), label says what it measures in 2-5 words. No dates, no years, no version numbers.
  Use an empty list when the article has no such numbers.
- cards.outro: e.g. "Follow for daily AI news".

Reply with ONLY a JSON object of this shape, no markdown:
{"title": string, "description": string, "hashtags": string[],
 "scenes": [{"narration": string, "pexelsQuery": string}],
 "cards": {"hook": string, "stats": [{"value": string, "label": string}], "outro": string}}`;

type Message = { role: "system" | "user" | "assistant"; content: string };

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Agnes did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

/** Ask Agnes for JSON and validate it; on failure, send the error back so it can correct itself. */
async function askJson<T>(messages: Message[], parse: (raw: unknown) => T, temperature: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await agnes().chat.completions.create({ model: env().AGNES_MODEL, messages, temperature });
    const content = res.choices[0]?.message?.content ?? "";
    try {
      return parse(extractJson(content));
    } catch (err) {
      lastError = err;
      console.warn(`[agnes] attempt ${attempt + 1} rejected: ${(err as Error).message}`);
      messages = [
        ...messages,
        { role: "assistant", content },
        { role: "user", content: `That reply was invalid: ${(err as Error).message}. Reply again with only the corrected JSON.` },
      ];
    }
  }
  throw new Error(`Agnes reply invalid: ${(lastError as Error)?.message ?? lastError}`);
}

async function pickStory(stories: StoryRow[]): Promise<StoryRow> {
  const list = stories
    .map((s, i) => `[${i}] (${s.source}) ${s.title}${s.summary ? `\n    ${s.summary.slice(0, 250)}` : ""}`)
    .join("\n");
  const covered = recentlyUsedTitles();
  const done = covered.length ? covered.map((t) => `- ${t}`).join("\n") : "(none yet)";

  const { storyIndex } = await askJson(
    [
      { role: "system", content: PICK_PROMPT },
      { role: "user", content: `Today's AI stories:\n${list}\n\nAlready covered recently:\n${done}` },
    ],
    (raw) => z.object({ storyIndex: z.number().int().min(0).max(stories.length - 1) }).parse(raw),
    0.3,
  );
  return stories[storyIndex];
}

function validateScript(raw: unknown): ShortScript {
  const script = shortScriptSchema.parse(raw);
  const words = wordCount(fullNarration(script));
  if (words < MIN_WORDS * 0.8 || words > MAX_WORDS * 1.2) {
    const fix = words < MIN_WORDS ? "Add more scenes with real details from the article" : "Shorten the scenes";
    throw new Error(`Narration is ${words} words but must be ${MIN_WORDS}-${MAX_WORDS}. ${fix}`);
  }
  if (!script.hashtags.some((h) => h.toLowerCase() === "#shorts")) script.hashtags.unshift("#Shorts");
  return script;
}

async function writeScript(story: StoryRow, article: string): Promise<ShortScript> {
  const content = [
    `Source: ${story.source}`,
    `Headline: ${story.title}`,
    `URL: ${story.url}`,
    `Article text:\n${article}`,
  ].join("\n");

  return askJson(
    [
      { role: "system", content: WRITE_PROMPT },
      { role: "user", content },
    ],
    validateScript,
    0.8,
  );
}

export type GeneratedScript = {
  id: number;
  story: StoryRow;
  script: ShortScript;
  narration: string;
  words: number;
  articleChars: number;
};

/** Refresh the news, let Agnes pick the best unused story, read the article, and save a Shorts script for it. */
export async function generateScript(): Promise<GeneratedScript> {
  await refreshNews();
  let story: StoryRow | undefined;
  let article = "";
  const skipped: string[] = [];

  for (let pick = 0; pick < MAX_STORY_PICKS && !story; pick++) {
    const stories = unusedStories();
    if (stories.length === 0) break;
    const candidate = await pickStory(stories);
    const text = await fetchArticleText(candidate.url);
    if (text.length >= MIN_ARTICLE_CHARS) {
      story = candidate;
      article = text;
    } else {
      markStorySkipped(candidate.id);
      skipped.push(candidate.title);
      console.warn(`[script] skipped "${candidate.title}": article unreadable (${text.length} chars)`);
    }
  }

  if (!story) {
    throw new Error(
      skipped.length
        ? `Skipped ${skipped.length} stories with unreadable articles (paywall/bot block). Try again for the next one.`
        : "No new AI stories found in the last 48 hours",
    );
  }

  const script = await writeScript(story, article);

  const { lastInsertRowid } = getDb()
    .prepare(`INSERT INTO scripts (story_id, data) VALUES (?, ?)`)
    .run(story.id, JSON.stringify(script));
  markStoryUsed(story.id);

  const narration = fullNarration(script);
  return { id: Number(lastInsertRowid), story, script, narration, words: wordCount(narration), articleChars: article.length };
}

export type ScriptListItem = {
  id: number;
  status: string;
  created_at: string;
  story_title: string;
  story_url: string;
  source: string;
  script: ShortScript;
};

export function listScripts(limit = 20): ScriptListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT sc.id, sc.status, sc.created_at, sc.data, st.title AS story_title, st.url AS story_url, st.source
       FROM scripts sc JOIN stories st ON st.id = sc.story_id
       ORDER BY sc.id DESC LIMIT ?`,
    )
    .all(limit) as (Omit<ScriptListItem, "script"> & { data: string })[];
  return rows.map(({ data, ...row }) => ({ ...row, script: JSON.parse(data) as ShortScript }));
}
