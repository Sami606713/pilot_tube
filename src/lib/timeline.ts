/**
 * Pure timing rules shared by the dashboard preview and (in Phase 5) the Remotion render,
 * so what you preview is what gets rendered.
 */

export type TimedWord = { word: string; start: number; end: number };
export type SceneTiming = { index: number; start: number; end: number };
export type CardKind = "hook" | "stat" | "outro";

export const CARD_SECONDS = 3;
const MAX_WORDS_PER_CAPTION = 3;

export type CaptionPage = { start: number; end: number; words: TimedWord[] };

/** Group words into short caption pages (max 3 words, break after punctuation), the usual Shorts style. */
export function captionPages(words: TimedWord[]): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let current: TimedWord[] = [];
  const flush = () => {
    if (current.length === 0) return;
    pages.push({ start: current[0].start, end: current[current.length - 1].end, words: current });
    current = [];
  };
  for (const word of words) {
    current.push(word);
    if (current.length >= MAX_WORDS_PER_CAPTION || /[.!?,;:]$/.test(word.word)) flush();
  }
  flush();
  // Hold each page until the next one starts, so captions don't flicker off between words.
  return pages.map((page, i) => ({ ...page, end: pages[i + 1]?.start ?? page.end }));
}

export type CardSlot = { name: string; kind: CardKind; start: number; end: number };

/**
 * When each card shows: hook at the very start, outro over the last 3 seconds,
 * stat cards at the start of scenes 2, 3, 4 (one per stat), never overlapping the hook or outro.
 */
export function cardSchedule(cards: { name: string; kind: CardKind }[], scenes: SceneTiming[], duration: number): CardSlot[] {
  const slots: CardSlot[] = [];
  const outroStart = Math.max(duration - CARD_SECONDS, 0);
  let statIndex = 0;
  // Stat cards start after the hook and after the previous stat card.
  let lastEnd = Math.min(CARD_SECONDS, duration);
  for (const card of cards) {
    if (card.kind === "hook") slots.push({ ...card, start: 0, end: Math.min(CARD_SECONDS, duration) });
    else if (card.kind === "outro") slots.push({ ...card, start: outroStart, end: duration });
    else {
      const scene = scenes[statIndex + 1];
      statIndex++;
      if (!scene) continue;
      const start = Math.max(scene.start, lastEnd);
      const end = Math.min(start + CARD_SECONDS, outroStart);
      if (end - start >= 1.5) {
        slots.push({ ...card, start, end });
        lastEnd = end;
      }
    }
  }
  return slots;
}

/** Index of the item whose [start, end) contains t; -1 when none. Items must be sorted by start. */
export function indexAt<T extends { start: number; end: number }>(items: T[], t: number): number {
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t < items[mid].start) hi = mid - 1;
    else if (t >= items[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
