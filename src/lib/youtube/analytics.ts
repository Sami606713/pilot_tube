import "server-only";
import { runYouTubeTool } from "@/lib/composio";

export const RANGE_DAYS = [7, 28, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export type ChannelInfo = {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  subscribers: number;
  views: number;
  videos: number;
};

export type PeriodTotals = {
  views: number;
  minutesWatched: number;
  /** Seconds. */
  avgViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
  likes: number;
  comments: number;
  shares: number;
};

export type DailyPoint = { date: string; views: number; subscribersGained: number };
export type TrafficSource = { source: string; label: string; views: number };

export type YouTubeOverview = {
  channel: ChannelInfo;
  days: RangeDays;
  current: PeriodTotals;
  previous: PeriodTotals;
  daily: DailyPoint[];
  traffic: TrafficSource[];
  fetchedAt: string;
};

export type VideoStat = {
  id: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  privacy: string;
  views: number;
  likes: number;
  comments: number;
  thumbnail: string | null;
  url: string;
};

// YouTube Analytics traffic source codes, in plain words.
const TRAFFIC_LABELS: Record<string, string> = {
  YT_SEARCH: "YouTube search",
  SHORTS: "Shorts feed",
  YT_CHANNEL: "Channel page",
  SUBSCRIBER: "Subscriptions",
  YT_OTHER_PAGE: "Other YouTube pages",
  RELATED_VIDEO: "Suggested videos",
  EXT_URL: "External sites",
  NOTIFICATION: "Notifications",
  PLAYLIST: "Playlists",
  YT_PLAYLIST_PAGE: "Playlist pages",
  SHORTS_CONTENT_LINKS: "Links in Shorts",
  END_SCREEN: "End screens",
  ANNOTATION: "Cards",
  NO_LINK_OTHER: "Direct or unknown",
  NO_LINK_EMBEDDED: "Embedded players",
  HASHTAGS: "Hashtag pages",
};

// Reads through Composio cost tool calls and take ~1s each; the dashboard reuses them for 15 minutes.
const TTL_MS = 15 * 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/** Cache the promise, so dashboard parts that ask at the same moment share one fetch. Failures aren't kept. */
function cached<T>(key: string, force: boolean, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}

export function clearYouTubeCache() {
  cache.clear();
}

const day = (offsetDays: number) => new Date(Date.now() - offsetDays * 86400_000).toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0) || 0;

type AnalyticsTable = { columnHeaders?: { name: string }[]; rows?: (string | number)[][] };

async function analytics(args: { startDate: string; endDate: string; metrics: string; dimensions?: string; sort?: string }): Promise<Record<string, string | number>[]> {
  const table = await runYouTubeTool<AnalyticsTable>("YOUTUBE_QUERY_ANALYTICS", { ids: "channel==MINE", ...args });
  const names = (table.columnHeaders ?? []).map((h) => h.name);
  return (table.rows ?? []).map((row) => Object.fromEntries(row.map((v, i) => [names[i], v])));
}

const TOTAL_METRICS = "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares";

async function periodTotals(startDate: string, endDate: string): Promise<PeriodTotals> {
  const [row = {}] = await analytics({ startDate, endDate, metrics: TOTAL_METRICS });
  return {
    views: num(row.views),
    minutesWatched: num(row.estimatedMinutesWatched),
    avgViewDuration: num(row.averageViewDuration),
    subscribersGained: num(row.subscribersGained),
    subscribersLost: num(row.subscribersLost),
    likes: num(row.likes),
    comments: num(row.comments),
    shares: num(row.shares),
  };
}

type ChannelResponse = {
  channels?: {
    id: string;
    snippet?: { title?: string; customUrl?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  }[];
};

async function channelInfo(): Promise<ChannelInfo> {
  const data = await runYouTubeTool<ChannelResponse>("YOUTUBE_GET_CHANNEL_STATISTICS", { mine: true, part: "snippet,statistics" });
  const ch = data.channels?.[0];
  if (!ch) throw new Error("No YouTube channel found on the connected account");
  return {
    id: ch.id,
    title: ch.snippet?.title ?? "Your channel",
    handle: ch.snippet?.customUrl ?? null,
    thumbnail: ch.snippet?.thumbnails?.medium?.url ?? ch.snippet?.thumbnails?.default?.url ?? null,
    subscribers: num(ch.statistics?.subscriberCount),
    views: num(ch.statistics?.viewCount),
    videos: num(ch.statistics?.videoCount),
  };
}

/** Channel totals plus analytics for the last `days` and the `days` before that (for the change). */
export function getYouTubeOverview(days: RangeDays, opts: { force?: boolean } = {}): Promise<YouTubeOverview> {
  return cached(`overview:${days}`, Boolean(opts.force), async () => {
    const endDate = day(0);
    const startDate = day(days - 1);
    const [channel, current, previous, dailyRows, trafficRows] = await Promise.all([
      channelInfo(),
      periodTotals(startDate, endDate),
      periodTotals(day(days * 2 - 1), day(days)),
      analytics({ startDate, endDate, metrics: "views,subscribersGained", dimensions: "day", sort: "day" }),
      analytics({ startDate, endDate, metrics: "views", dimensions: "insightTrafficSourceType", sort: "-views" }),
    ]);

    // Fill days with no data so the chart's x-axis is continuous.
    const byDate = new Map(dailyRows.map((r) => [String(r.day), r]));
    const daily: DailyPoint[] = Array.from({ length: days }, (_, i) => {
      const date = day(days - 1 - i);
      const r = byDate.get(date);
      return { date, views: num(r?.views), subscribersGained: num(r?.subscribersGained) };
    });

    const traffic = trafficRows
      .map((r) => ({ source: String(r.insightTrafficSourceType), label: TRAFFIC_LABELS[String(r.insightTrafficSourceType)] ?? String(r.insightTrafficSourceType), views: num(r.views) }))
      .filter((t) => t.views > 0);

    return { channel, days, current, previous, daily, traffic, fetchedAt: new Date().toISOString() };
  });
}

/** ISO 8601 duration ("PT1M41S") to seconds. */
function durationSeconds(iso: string | undefined): number {
  const m = iso?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return num(m[1]) * 86400 + num(m[2]) * 3600 + num(m[3]) * 60 + num(m[4]);
}

type PlaylistItems = { items?: { contentDetails?: { videoId?: string }; snippet?: { resourceId?: { videoId?: string } } }[] };
type VideoBatch = {
  items?: {
    id: string;
    snippet?: { title?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } };
    contentDetails?: { duration?: string };
    status?: { privacyStatus?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
};

/** The channel's 50 most recent uploads with their stats. */
export function getYouTubeVideos(opts: { force?: boolean } = {}): Promise<VideoStat[]> {
  return cached("videos", Boolean(opts.force), async () => {
    const list = await runYouTubeTool<PlaylistItems>("YOUTUBE_LIST_CHANNEL_VIDEOS", { mine: true, part: "snippet,contentDetails", maxResults: 50 });
    const ids = (list.items ?? []).map((i) => i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];
    const batch = await runYouTubeTool<VideoBatch>("YOUTUBE_GET_VIDEO_DETAILS_BATCH", { id: ids, parts: ["snippet", "statistics", "contentDetails", "status"] });
    return (batch.items ?? [])
      .map((v) => ({
        id: v.id,
        title: v.snippet?.title ?? "Untitled",
        publishedAt: v.snippet?.publishedAt ?? "",
        durationSeconds: durationSeconds(v.contentDetails?.duration),
        privacy: v.status?.privacyStatus ?? "unknown",
        views: num(v.statistics?.viewCount),
        likes: num(v.statistics?.likeCount),
        comments: num(v.statistics?.commentCount),
        thumbnail: v.snippet?.thumbnails?.medium?.url ?? null,
        url: `https://www.youtube.com/watch?v=${v.id}`,
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  });
}

/** Percent change from `before` to `now`; null when there is no baseline. */
export function percentChange(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / before) * 100;
}
