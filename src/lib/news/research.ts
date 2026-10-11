import "server-only";
import { getDb } from "@/lib/db";
import { isAIRelated, nicheQuery, searchBingNews, searchHackerNews, type NewsItem } from "./sources";
import { saveStories, type StoryRow } from "./store";

export const RANGES = { today: 1, week: 7, month: 30 } as const;
export type Range = keyof typeof RANGES;
export type Sort = "newest" | "popular";
export type StatusFilter = "all" | "new" | "used" | "skipped";

export type ResearchParams = {
  q: string;
  range: Range;
  source: string;
  sort: Sort;
  status: StatusFilter;
};

export type ResearchStory = {
  id: number;
  title: string;
  url: string;
  source: string;
  summary: string | null;
  publishedAt: string;
  points: number | null;
  comments: number | null;
  image: string | null;
  status: "new" | "used" | "skipped";
  /** Found by this search on the live web (not fetched before). */
  live: boolean;
};

export type ResearchResult = {
  stories: ResearchStory[];
  sources: { source: string; count: number }[];
  trending: { topic: string; count: number }[];
  liveErrors: string[];
};

/** Known names in the AI niche; trending counts how many stories mention each. */
const TOPICS: [string, RegExp][] = [
  ["OpenAI", /\bopenai\b|\bchatgpt\b|\bgpt-?\d/i],
  ["Anthropic", /\banthropic\b|\bclaude\b/i],
  ["Google Gemini", /\bgemini\b|\bdeepmind\b/i],
  ["Nvidia", /\bnvidia\b/i],
  ["Meta AI", /\bmeta\b|\bllama\b/i],
  ["Microsoft", /\bmicrosoft\b|\bcopilot\b/i],
  ["Apple", /\bapple\b/i],
  ["xAI / Grok", /\bxai\b|\bgrok\b/i],
  ["DeepSeek", /\bdeepseek\b/i],
  ["Mistral", /\bmistral\b/i],
  ["AI agents", /\bagents?\b|\bagentic\b/i],
  ["Open source", /\bopen[- ]source\b|\bopen[- ]weights?\b/i],
  ["AI chips", /\bchips?\b|\bgpus?\b|\btpu\b/i],
  ["Robotics", /\brobot\w*\b|\bhumanoid\b/i],
  ["AI safety", /\bsafety\b|\balignment\b|\brogue\b/i],
  ["Regulation", /\bregulat\w*\b|\blaw\b|\blawsuit\b|\bcongress\b|\beu ai act\b/i],
  ["Funding", /\braises?\b|\bfunding\b|\bvaluation\b|\bacquire\w*\b/i],
];

// Live searches hit outside APIs; repeat searches within 5 minutes reuse the results.
const LIVE_TTL_MS = 5 * 60_000;
const liveCache = new Map<string, { at: number; items: NewsItem[]; errors: string[] }>();

async function liveSearch(q: string, range: Range): Promise<{ items: NewsItem[]; errors: string[] }> {
  const key = `${q.toLowerCase()}|${range}`;
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit;

  const since = new Date(Date.now() - RANGES[range] * 86400_000);
  const query = nicheQuery(q);
  const jobs = [
    { name: "Hacker News", run: () => searchHackerNews(query, since, { sort: "relevance", minPoints: 3, limit: 40 }) },
    { name: "Bing News", run: () => searchBingNews(query) },
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const items: NewsItem[] = [];
  const errors: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value.filter((item) => item.publishedAt >= since && isAIRelated(`${item.title} ${item.summary}`)));
    else errors.push(`${jobs[i].name}: ${String(r.reason?.message ?? r.reason)}`);
  });

  const result = { at: Date.now(), items, errors };
  liveCache.set(key, result);
  return result;
}

function toStory(row: StoryRow, live: boolean): ResearchStory {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    source: row.source,
    summary: row.summary,
    publishedAt: row.published_at,
    points: row.points ?? null,
    comments: row.comments ?? null,
    image: row.image ?? null,
    status: row.used_at ? "used" : row.skipped_at ? "skipped" : "new",
    live,
  };
}

/** Saved stories in the range, plus a live web search when there is a query. */
export async function research(params: ResearchParams): Promise<ResearchResult> {
  const db = getDb();
  const since = new Date(Date.now() - RANGES[params.range] * 86400_000).toISOString();
  const q = params.q.trim();

  // Live results are saved, so they get an id (for "Make Short") and show up in future searches.
  let liveUrls = new Set<string>();
  let liveErrors: string[] = [];
  if (q.length >= 2) {
    const live = await liveSearch(q, params.range);
    saveStories(live.items);
    liveUrls = new Set(live.items.map((i) => i.url));
    liveErrors = live.errors;
  }

  const like = `%${q.replace(/[%_]/g, "")}%`;
  const saved = db
    .prepare(
      `SELECT * FROM stories WHERE published_at >= ?
       AND (? = '' OR title LIKE ? OR summary LIKE ?)
       ORDER BY published_at DESC LIMIT 300`,
    )
    .all(since, q, like, like) as StoryRow[];

  const liveRows = liveUrls.size
    ? (db
        .prepare(`SELECT * FROM stories WHERE url IN (${[...liveUrls].map(() => "?").join(",")})`)
        .all(...liveUrls) as StoryRow[])
    : [];

  const byId = new Map<number, ResearchStory>();
  for (const row of liveRows) byId.set(row.id, toStory(row, true));
  for (const row of saved) if (!byId.has(row.id)) byId.set(row.id, toStory(row, false));
  // AI niche only: older saved stories from before this filter existed are hidden too.
  let stories = [...byId.values()].filter((s) => isAIRelated(`${s.title} ${s.summary ?? ""}`));

  // Facets and trending describe everything found, before the source/status filters.
  const sourceCounts = new Map<string, number>();
  for (const s of stories) sourceCounts.set(s.source, (sourceCounts.get(s.source) ?? 0) + 1);
  const trending = TOPICS.map(([topic, re]) => ({ topic, count: stories.filter((s) => re.test(`${s.title} ${s.summary ?? ""}`)).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (params.source !== "all") stories = stories.filter((s) => s.source === params.source);
  if (params.status !== "all") stories = stories.filter((s) => s.status === params.status);

  stories.sort((a, b) =>
    params.sort === "popular"
      ? (b.points ?? -1) - (a.points ?? -1) || b.publishedAt.localeCompare(a.publishedAt)
      : b.publishedAt.localeCompare(a.publishedAt),
  );

  return {
    stories: stories.slice(0, 120),
    sources: [...sourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    trending,
    liveErrors,
  };
}

export function parseResearchParams(search: URLSearchParams): ResearchParams {
  const range = search.get("range");
  const sort = search.get("sort");
  const status = search.get("status");
  return {
    q: (search.get("q") ?? "").slice(0, 120),
    range: range && range in RANGES ? (range as Range) : "week",
    source: search.get("source") || "all",
    sort: sort === "popular" ? "popular" : "newest",
    status: status === "new" || status === "used" || status === "skipped" ? status : "all",
  };
}
