import type { TimedWord } from "./deepgram";

export type SceneTiming = { index: number; start: number; end: number };

const normalize = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Put the script's own words (correct spelling of names like "Anthropic") onto the
 * timestamps Deepgram heard. Uses an edit-distance alignment so a few misheard,
 * merged or split words don't shift every caption after them.
 */
export function alignWords(scriptText: string, heard: TimedWord[]): TimedWord[] {
  const script = scriptText.split(/\s+/).filter(Boolean);
  if (heard.length === 0) return [];

  const n = script.length;
  const m = heard.length;
  // dp[i][j] = cost of aligning script[0..i) with heard[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = normalize(script[i - 1]) === normalize(heard[j - 1].word) ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + same, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }

  // Walk back: matched/substituted pairs take the heard timing; extra script words
  // get squeezed into the neighbouring heard word's time span.
  const out: (TimedWord | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const same = normalize(script[i - 1]) === normalize(heard[j - 1].word) ? 0 : 1;
    if (dp[i][j] === dp[i - 1][j - 1] + same) {
      out[i - 1] = { word: script[i - 1], start: heard[j - 1].start, end: heard[j - 1].end };
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      i--; // script word with no heard match — filled below
    } else {
      j--; // heard word not in script (e.g. a number spelled differently) — dropped
    }
  }

  for (let k = 0; k < n; k++) {
    if (out[k]) continue;
    const prev = out.slice(0, k).reverse().find(Boolean) ?? null;
    const next = out.slice(k + 1).find(Boolean) ?? null;
    const start = prev?.end ?? heard[0].start;
    const end = next?.start ?? heard[m - 1].end;
    out[k] = { word: script[k], start, end: Math.max(start, end) };
  }
  return out as TimedWord[];
}

/**
 * Start/end time of each scene, from how many words each scene's narration has.
 * Scenes are back to back (each ends where the next starts) so clips never leave a gap.
 */
export function sceneTimings(sceneTexts: string[], words: TimedWord[], duration: number): SceneTiming[] {
  let cursor = 0;
  const starts = sceneTexts.map((text, index) => {
    const start = index === 0 ? 0 : (words[cursor]?.start ?? duration);
    cursor += text.split(/\s+/).filter(Boolean).length;
    return start;
  });
  return starts.map((start, index) => ({ index, start, end: starts[index + 1] ?? duration }));
}
