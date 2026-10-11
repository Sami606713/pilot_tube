import "server-only";
import Parser from "rss-parser";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: Date;
  /** Hacker News points and comments, when available: a rough popularity signal. */
  points?: number;
  comments?: number;
  image?: string;
};

const RSS_FEEDS: { source: string; url: string }[] = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { source: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { source: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { source: "Google AI", url: "https://blog.google/technology/ai/rss/" },
  { source: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
];

/**
 * The channel's niche is AI. A story counts as AI only when its title or summary says so clearly:
 * company or product names that are AI-only, or AI terms. Plain "Nvidia" or "agent" is not enough.
 */
const AI_TERMS = new RegExp(
  [
    String.raw`\bai\b`,
    String.raw`\ba\.i\.`,
    String.raw`artificial intelligence`,
    String.raw`machine learning`,
    String.raw`deep learning`,
    String.raw`neural (?:net|network)s?`,
    String.raw`\bllms?\b`,
    String.raw`language models?`,
    String.raw`\bgen ?ai\b`,
    String.raw`\bgpt[- ]?\w*`,
    String.raw`chatgpt`,
    String.raw`openai`,
    String.raw`anthropic`,
    String.raw`\bclaude\b`,
    String.raw`\bgemini\b`,
    String.raw`deepmind`,
    String.raw`\bcopilot\b`,
    String.raw`\bmistral\b`,
    String.raw`\bllama\b`,
    String.raw`deepseek`,
    String.raw`\bgrok\b`,
    String.raw`hugging ?face`,
    String.raw`perplexity`,
    String.raw`midjourney`,
    String.raw`stable diffusion`,
    String.raw`\bsora\b`,
    String.raw`chatbots?`,
    String.raw`agentic`,
    String.raw`\bai agents?\b`,
    String.raw`humanoid`,
    String.raw`\bagi\b`,
    // Model families and AI infrastructure terms that headlines use without saying "AI".
    String.raw`nemotron`,
    String.raw`\bqwen\b`,
    String.raw`\binference\b`,
    String.raw`foundation models?`,
    String.raw`open[- ]weights?`,
    String.raw`reasoning models?`,
  ].join("|"),
  "i",
);

/** True when a story is about AI (the channel's niche). */
export function isAIRelated(text: string): boolean {
  return AI_TERMS.test(text);
}

type MediaField = { $?: { url?: string } } | undefined;
type RssItem = { mediaContent?: MediaField; mediaThumbnail?: MediaField; enclosure?: { url?: string; type?: string }; content?: string };

const parser = new Parser<Record<string, unknown>, RssItem>({
  timeout: 15_000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-shorts-bot/1.0)" },
  customFields: { item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]] },
});

function clean(text: string | undefined, max = 500): string {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|quot|#39|apos|lt|gt|nbsp);/g, (_, e: string) => ({ amp: "&", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">", nbsp: " " })[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function rssImage(item: RssItem): string | undefined {
  const fromMedia = item.mediaContent?.$?.url ?? item.mediaThumbnail?.$?.url;
  if (fromMedia) return fromMedia;
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) return item.enclosure.url;
  return item.content?.match(/<img[^>]+src=["']([^"']+)/i)?.[1];
}

async function fetchRss(feed: { source: string; url: string }): Promise<NewsItem[]> {
  const result = await parser.parseURL(feed.url);
  return result.items.flatMap((item) => {
    const date = item.isoDate ?? item.pubDate;
    if (!item.title || !item.link || !date) return [];
    return [
      {
        title: clean(item.title, 200),
        url: item.link,
        source: feed.source,
        summary: clean(item.contentSnippet ?? item.content ?? item.summary),
        publishedAt: new Date(date),
        image: rssImage(item),
      },
    ];
  });
}

type HnHit = {
  title: string | null;
  url: string | null;
  objectID: string;
  points: number | null;
  num_comments: number | null;
  created_at_i: number;
};

/**
 * Hacker News stories (Algolia API) about `query` since `since`.
 * "relevance" ranks by match and popularity; "date" returns the newest first.
 */
export async function searchHackerNews(query: string, since: Date, opts: { sort?: "relevance" | "date"; minPoints?: number; limit?: number } = {}): Promise<NewsItem[]> {
  const { sort = "relevance", minPoints = 5, limit = 50 } = opts;
  const params = new URLSearchParams({
    query,
    tags: "story",
    hitsPerPage: String(limit),
    numericFilters: `created_at_i>${Math.floor(since.getTime() / 1000)},points>${minPoints}`,
  });
  const endpoint = sort === "date" ? "search_by_date" : "search";
  const res = await fetch(`https://hn.algolia.com/api/v1/${endpoint}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Hacker News API returned ${res.status}`);
  const { hits } = (await res.json()) as { hits: HnHit[] };

  return hits.flatMap((hit) =>
    hit.title
      ? [
          {
            title: hit.title,
            url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
            source: "Hacker News",
            summary: "",
            publishedAt: new Date(hit.created_at_i * 1000),
            points: hit.points ?? undefined,
            comments: hit.num_comments ?? undefined,
          },
        ]
      : [],
  );
}

/**
 * Bing News RSS search: fresh stories (mostly the last few days) from thousands of outlets,
 * with the real article URL (unlike Google News redirect links) and a preview image.
 */
export async function searchBingNews(query: string): Promise<NewsItem[]> {
  const params = new URLSearchParams({ q: query, format: "rss", count: "50" });
  const res = await fetch(`https://www.bing.com/news/search?${params}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-shorts-bot/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Bing News returned ${res.status}`);
  const xml = await res.text();

  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].flatMap(([, item]) => {
    const tag = (name: string) => item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];
    const link = clean(tag("link"));
    // The real article is in the click-tracking link's url= parameter.
    const url = (() => {
      try {
        return new URL(link).searchParams.get("url") ?? link;
      } catch {
        return null;
      }
    })();
    const title = clean(tag("title"), 200);
    const date = tag("pubDate");
    if (!url || !title || !date) return [];
    const image = clean(tag("News:Image"));
    return [
      {
        title,
        url,
        source: clean(tag("News:Source")) || new URL(url).hostname.replace(/^www\./, ""),
        summary: clean(tag("description")),
        publishedAt: new Date(date),
        // Bing thumbnails accept a width; 480px is plenty for cards.
        image: image ? `${image}&w=480` : undefined,
      },
    ];
  });
}

/** Add "AI" to searches that aren't already about AI ("Nvidia" becomes "Nvidia AI"), so results stay in the niche. */
export function nicheQuery(query: string): string {
  const q = query.trim();
  return AI_TERMS.test(q) ? q : `${q} AI`;
}

/** Fetch AI news from every source published within the last `hours`. One failing source never breaks the run. */
export async function fetchLatestNews(hours = 24): Promise<{ items: NewsItem[]; errors: string[] }> {
  const since = new Date(Date.now() - hours * 3600_000);
  const jobs = [
    { source: "Hacker News", run: () => searchHackerNews("AI", since, { sort: "date", minPoints: 30 }) },
    { source: "Bing News", run: () => searchBingNews("artificial intelligence") },
    ...RSS_FEEDS.map((feed) => ({ source: feed.source, run: () => fetchRss(feed) })),
  ];

  const results = await Promise.allSettled(jobs.map((job) => job.run()));
  const items: NewsItem[] = [];
  const errors: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push(`${jobs[i].source}: ${String(result.reason?.message ?? result.reason)}`);
  });

  const fresh = items.filter((item) => item.publishedAt >= since && !Number.isNaN(item.publishedAt.getTime()));
  return { items: dedupe(fresh.filter((item) => isAIRelated(`${item.title} ${item.summary}`))), errors };
}

/** Drop repeats of the same article (same URL ignoring query string and trailing slash), newest first. */
export function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = item.url.replace(/[?#].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
