import "server-only";

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

export type TimedWord = { word: string; start: number; end: number };

type ListenResponse = {
  metadata: { duration: number };
  results: {
    channels: { alternatives: { words: { word: string; punctuated_word?: string; start: number; end: number }[] }[] }[];
  };
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
  return {
    duration: json.metadata.duration,
    words: words.map((w) => ({ word: w.punctuated_word ?? w.word, start: w.start, end: w.end })),
  };
}
