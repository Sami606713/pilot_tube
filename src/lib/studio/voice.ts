import "server-only";
import type { TimedWord } from "./types";

const API = "https://api.deepgram.com/v1";
// Deepgram's /speak endpoint accepts up to 2000 characters per request.
const MAX_SPEAK_CHARS = 1900;

function apiKey(): string {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is missing in .env.local");
  return key;
}

async function deepgramError(res: Response, what: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  return new Error(`Deepgram ${what} failed (${res.status}): ${body.slice(0, 300)}`);
}

/** Split long text on sentence boundaries so each piece fits one /speak request. */
function chunkText(text: string): string[] {
  if (text.length <= MAX_SPEAK_CHARS) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_SPEAK_CHARS && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Text → MP3 with Deepgram Aura-2. */
export async function synthesize(text: string, voice: string): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const chunk of chunkText(text)) {
    const res = await fetch(`${API}/speak?model=${encodeURIComponent(voice)}&encoding=mp3`, {
      method: "POST",
      headers: { Authorization: `Token ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk }),
    });
    if (!res.ok) throw await deepgramError(res, "text-to-speech");
    parts.push(Buffer.from(await res.arrayBuffer()));
  }
  // MP3 frames can be concatenated directly.
  return Buffer.concat(parts);
}

type ListenResponse = {
  metadata: { duration: number };
  results: { channels: { alternatives: { words: { word: string; punctuated_word?: string; start: number; end: number }[] }[] }[] };
};

/** MP3 → word-level timestamps with Deepgram Nova-3. */
export async function transcribe(audio: Buffer): Promise<{ duration: number; words: TimedWord[] }> {
  const res = await fetch(`${API}/listen?model=nova-3&smart_format=true&punctuate=true`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey()}`, "Content-Type": "audio/mpeg" },
    body: new Uint8Array(audio),
  });
  if (!res.ok) throw await deepgramError(res, "speech-to-text");
  const json = (await res.json()) as ListenResponse;
  const words = json.results.channels[0]?.alternatives[0]?.words ?? [];
  return { duration: json.metadata.duration, words: words.map((w) => ({ word: w.punctuated_word ?? w.word, start: w.start, end: w.end })) };
}

const normalize = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Put the script's own words (correct spelling of names like "Maia") onto the timestamps
 * Deepgram heard. Edit-distance alignment, so a few misheard, merged or split words don't
 * shift every caption after them.
 */
export function alignWords(scriptText: string, heard: TimedWord[]): TimedWord[] {
  const script = scriptText.split(/\s+/).filter(Boolean);
  if (heard.length === 0) return [];
  const n = script.length;
  const m = heard.length;
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
  const out: (TimedWord | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const same = normalize(script[i - 1]) === normalize(heard[j - 1].word) ? 0 : 1;
    if (dp[i][j] === dp[i - 1][j - 1] + same) {
      out[i - 1] = { word: script[i - 1], start: heard[j - 1].start, end: heard[j - 1].end };
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
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

/** Start/end of each line from its word count; lines are back to back so visuals never leave a gap. */
export function lineTimings(lineTexts: string[], words: TimedWord[], duration: number): { start: number; end: number }[] {
  let cursor = 0;
  const starts = lineTexts.map((text, index) => {
    const start = index === 0 ? 0 : (words[cursor]?.start ?? duration);
    cursor += text.split(/\s+/).filter(Boolean).length;
    return start;
  });
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? duration }));
}
