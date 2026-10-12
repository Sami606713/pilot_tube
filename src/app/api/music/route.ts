import { addTrack, listTracks, MOODS, type License, type Mood } from "@/lib/music/library";

export async function GET() {
  return Response.json({ tracks: listTracks() });
}

/** Upload a track (multipart form: file, title, artist, mood, license, attribution). */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const mood = String(form.get("mood") ?? "") as Mood;
    const license = String(form.get("license") ?? "standard") as License;
    if (!(file instanceof File)) throw new Error("Choose an audio file");
    if (!title) throw new Error("Give the track a title");
    if (!MOODS.includes(mood)) throw new Error("Pick a mood");
    if (license !== "standard" && license !== "cc") throw new Error("Pick a license");
    const track = await addTrack({
      file,
      title,
      artist: String(form.get("artist") ?? "") || null,
      mood,
      license,
      attribution: String(form.get("attribution") ?? "") || null,
    });
    return Response.json({ track });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
