import "server-only";
import Parser from "rss-parser";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: Date;
  /** Hacker News points, when available — a rough popularity signal. */
  points?: number;
};

const RSS_FEEDS: { source: string; url: string }[] = [
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { source: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { source: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { source: "Google AI", url: "https://blog.google/technology/ai/rss/" },
  { source: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
];

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-shorts-bot/1.0)" },
});

function clean(text: string | undefined, max = 500): string {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
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
      },
    ];
  });
}

type HnHit = {
  title: string | null;
  url: string | null;
  objectID: string;
  points: number | null;
  created_at_i: number;
};

async function fetchHackerNews(since: Date): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    query: "AI",
    tags: "story",
    hitsPerPage: "50",
    numericFilters: `created_at_i>${Math.floor(since.getTime() / 1000)},points>30`,
  });
  const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${params}`);
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
          },
        ]
      : [],
  );
}

/** Fetch AI news from every source published within the last `hours`. One failing source never breaks the run. */
export async function fetchLatestNews(hours = 24): Promise<{ items: NewsItem[]; errors: string[] }> {
  const since = new Date(Date.now() - hours * 3600_000);
  const jobs = [
    { source: "Hacker News", run: () => fetchHackerNews(since) },
    ...RSS_FEEDS.map((feed) => ({ source: feed.source, run: () => fetchRss(feed) })),
  ];

  const results = await Promise.allSettled(jobs.map((job) => job.run()));
  const items: NewsItem[] = [];
  const errors: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push(`${jobs[i].source}: ${String(result.reason?.message ?? result.reason)}`);
  });

  const seen = new Set<string>();
  const fresh = items
    .filter((item) => item.publishedAt >= since && !Number.isNaN(item.publishedAt.getTime()))
    .filter((item) => {
      const key = item.url.replace(/[?#].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return { items: fresh, errors };
}
