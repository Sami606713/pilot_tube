import "server-only";
import { getDb } from "@/lib/db";
import { fetchLatestNews, isAIRelated, type NewsItem } from "./sources";

export type StoryRow = {
  id: number;
  url: string;
  title: string;
  source: string;
  summary: string | null;
  published_at: string;
  used_at: string | null;
  skipped_at?: string | null;
  points?: number | null;
  comments?: number | null;
  image?: string | null;
};

/**
 * Save stories; already-saved URLs keep their status but get fresher points, comments and image.
 * Returns how many were new.
 */
export function saveStories(items: NewsItem[]): number {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO stories (url, title, source, summary, published_at, points, comments, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const refresh = db.prepare(
    `UPDATE stories SET points = COALESCE(?, points), comments = COALESCE(?, comments), image = COALESCE(image, ?) WHERE url = ?`,
  );
  let added = 0;
  for (const item of items) {
    const { changes } = insert.run(
      item.url,
      item.title,
      item.source,
      item.summary,
      item.publishedAt.toISOString(),
      item.points ?? null,
      item.comments ?? null,
      item.image ?? null,
    );
    if (Number(changes) > 0) added++;
    else refresh.run(item.points ?? null, item.comments ?? null, item.image ?? null, item.url);
  }
  return added;
}

/** Pull the latest news and save new stories. Already-saved URLs are skipped. */
export async function refreshNews(hours = 24) {
  const { items, errors } = await fetchLatestNews(hours);
  return { fetched: items.length, added: saveStories(items), errors };
}

/** AI stories from the last `hours` that have not been turned into a Short yet. */
export function unusedStories(hours = 48, limit = 40): StoryRow[] {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const rows = getDb()
    .prepare(
      `SELECT * FROM stories
       WHERE used_at IS NULL AND skipped_at IS NULL AND published_at >= ?
       ORDER BY published_at DESC LIMIT 300`,
    )
    .all(since) as StoryRow[];
  return rows.filter((s) => isAIRelated(`${s.title} ${s.summary ?? ""}`)).slice(0, limit);
}

/** Recent titles we already made Shorts about, so the AI avoids repeating a topic. */
export function recentlyUsedTitles(days = 14): string[] {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = getDb()
    .prepare(`SELECT title FROM stories WHERE used_at >= ? ORDER BY used_at DESC`)
    .all(since) as { title: string }[];
  return rows.map((r) => r.title);
}

/** Never offer this story again (e.g. its article is paywalled, so facts can't be checked). */
export function markStorySkipped(id: number) {
  getDb().prepare(`UPDATE stories SET skipped_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}

export function markStoryUsed(id: number) {
  getDb().prepare(`UPDATE stories SET used_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}

/** Every story from the last `hours`, whatever its status, for the news queue page. */
export function recentStories(hours = 48): StoryRow[] {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getDb()
    .prepare(`SELECT * FROM stories WHERE published_at >= ? ORDER BY published_at DESC`)
    .all(since) as StoryRow[];
}

export function getStory(id: number): StoryRow | null {
  return (getDb().prepare(`SELECT * FROM stories WHERE id = ?`).get(id) as StoryRow | undefined) ?? null;
}
