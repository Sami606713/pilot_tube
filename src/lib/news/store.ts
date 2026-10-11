import "server-only";
import { getDb } from "@/lib/db";
import { fetchLatestNews } from "./sources";

export type StoryRow = {
  id: number;
  url: string;
  title: string;
  source: string;
  summary: string | null;
  published_at: string;
  used_at: string | null;
  skipped_at?: string | null;
};

/** Pull the latest news and save new stories. Already-saved URLs are skipped. */
export async function refreshNews(hours = 24) {
  const { items, errors } = await fetchLatestNews(hours);
  const insert = getDb().prepare(
    `INSERT OR IGNORE INTO stories (url, title, source, summary, published_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  let added = 0;
  for (const item of items) {
    const { changes } = insert.run(
      item.url,
      item.title,
      item.source,
      item.summary,
      item.publishedAt.toISOString(),
    );
    added += Number(changes);
  }

  return { fetched: items.length, added, errors };
}

/** Stories from the last `hours` that have not been turned into a Short yet. */
export function unusedStories(hours = 48, limit = 40): StoryRow[] {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM stories
       WHERE used_at IS NULL AND skipped_at IS NULL AND published_at >= ?
       ORDER BY published_at DESC LIMIT ?`,
    )
    .all(since, limit) as StoryRow[];
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
