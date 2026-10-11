import "server-only";
import { getCards, type Card } from "@/lib/cards/render";
import { getRender, type RenderResult } from "@/lib/render/render";
import { getDb } from "@/lib/db";
import { getClips, type Clip } from "@/lib/footage/clips";
import { fullNarration, wordCount, type ShortScript } from "@/lib/script/schema";
import { unusedStories } from "@/lib/news/store";
import { getVoiceover, type Voiceover } from "@/lib/voice/voiceover";

/** Pipeline steps in order. Render and upload arrive in later phases. */
export const STEPS = ["script", "voice", "clips", "cards", "render", "upload"] as const;
export type Step = (typeof STEPS)[number];

export type ShortSummary = {
  id: number;
  title: string;
  hook: string;
  source: string;
  storyTitle: string;
  storyUrl: string;
  createdAt: string;
  words: number;
  sceneCount: number;
  /** Real voiceover length when it exists, otherwise an estimate from word count. */
  duration: number;
  hasVoice: boolean;
  clipCount: number;
  cardCount: number;
  /** Pexels id of the first scene clip, used as the thumbnail (and its cache key). */
  thumbId: number | null;
  /** When the final MP4 was rendered; also its cache key. */
  renderedAt: string | null;
  done: Step[];
  /** First step that still needs to run. */
  next: Step;
};

type SummaryRow = {
  id: number;
  created_at: string;
  data: string;
  story_title: string;
  story_url: string;
  source: string;
  voice_duration: number | null;
  clip_count: number;
  card_count: number;
  thumb_id: number | null;
  rendered_at: string | null;
};

function summarize(row: SummaryRow): ShortSummary {
  const script = JSON.parse(row.data) as ShortScript;
  const words = wordCount(fullNarration(script));
  const hasVoice = row.voice_duration !== null;
  const clipsDone = row.clip_count > 0 && row.clip_count >= script.scenes.length;
  const done: Step[] = ["script"];
  if (hasVoice) done.push("voice");
  if (clipsDone) done.push("clips");
  if (row.card_count > 0) done.push("cards");
  if (row.rendered_at) done.push("render");
  return {
    id: row.id,
    title: script.title,
    hook: script.cards.hook,
    source: row.source,
    storyTitle: row.story_title,
    storyUrl: row.story_url,
    createdAt: row.created_at,
    words,
    sceneCount: script.scenes.length,
    duration: row.voice_duration ?? words / 2.5,
    hasVoice,
    clipCount: row.clip_count,
    cardCount: row.card_count,
    thumbId: row.thumb_id,
    renderedAt: row.rendered_at,
    done,
    next: STEPS.find((s) => !done.includes(s)) ?? "upload",
  };
}

const SUMMARY_SQL = `
  SELECT sc.id, sc.created_at, sc.data,
         st.title AS story_title, st.url AS story_url, st.source,
         (SELECT v.duration FROM voiceovers v WHERE v.script_id = sc.id) AS voice_duration,
         (SELECT COUNT(*) FROM clips c WHERE c.script_id = sc.id) AS clip_count,
         (SELECT COUNT(*) FROM cards k WHERE k.script_id = sc.id) AS card_count,
         (SELECT c.pexels_id FROM clips c WHERE c.script_id = sc.id AND c.scene_index = 0) AS thumb_id,
         (SELECT r.created_at FROM renders r WHERE r.script_id = sc.id) AS rendered_at
  FROM scripts sc JOIN stories st ON st.id = sc.story_id`;

/** Every Short with its pipeline progress, newest first, in one query. */
export function listShorts(limit = 50): ShortSummary[] {
  const rows = getDb().prepare(`${SUMMARY_SQL} ORDER BY sc.id DESC LIMIT ?`).all(limit) as SummaryRow[];
  return rows.map(summarize);
}

export type ShortDetail = ShortSummary & {
  script: ShortScript;
  voiceover: Voiceover | null;
  clips: Clip[];
  cards: Card[];
  render: RenderResult | null;
};

export function getShort(id: number): ShortDetail | null {
  const row = getDb().prepare(`${SUMMARY_SQL} WHERE sc.id = ?`).get(id) as SummaryRow | undefined;
  if (!row) return null;
  return {
    ...summarize(row),
    script: JSON.parse(row.data) as ShortScript,
    voiceover: getVoiceover(id),
    clips: getClips(id),
    cards: getCards(id),
    render: getRender(id),
  };
}

export type Overview = {
  total: number;
  ready: number;
  rendered: number;
  inProgress: number;
  queuedStories: number;
  sources: { source: string; count: number }[];
  lastNewsAt: string | null;
};

/** Headline numbers for the dashboard. */
export function getOverview(shorts: ShortSummary[]): Overview {
  const db = getDb();
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  // Same AI-only rule as the story picker, so the dashboard count matches what can become a Short.
  const queued = { n: unusedStories(48, 10_000).length };
  const sources = db
    .prepare(
      `SELECT source, COUNT(*) AS count FROM stories WHERE published_at >= ? GROUP BY source ORDER BY count DESC`,
    )
    .all(since) as { source: string; count: number }[];
  const last = db.prepare(`SELECT MAX(fetched_at) AS at FROM stories`).get() as { at: string | null };

  const ready = shorts.filter((s) => s.next === "render").length;
  const rendered = shorts.filter((s) => s.done.includes("render")).length;
  return {
    total: shorts.length,
    ready,
    rendered,
    inProgress: shorts.length - ready - rendered,
    queuedStories: queued.n,
    sources,
    lastNewsAt: last.at,
  };
}

export type ShortStatus = { label: "Draft" | "In production" | "Ready to render" | "Rendered" | "Published"; tone: "muted" | "progress" | "ready" | "done" };

/** One human label per Short, shared by every list in the dashboard. */
export function shortStatus(short: Pick<ShortSummary, "done" | "next">): ShortStatus {
  if (short.done.includes("upload")) return { label: "Published", tone: "done" };
  if (short.done.includes("render")) return { label: "Rendered", tone: "done" };
  if (short.next === "render") return { label: "Ready to render", tone: "ready" };
  if (short.done.length > 1) return { label: "In production", tone: "progress" };
  return { label: "Draft", tone: "muted" };
}
