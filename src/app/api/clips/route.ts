import { after } from "next/server";
import { VIDEO_MODELS, type VideoModel } from "@/lib/clips/agnes-video";
import { createClip, listClips, runClip, type ClipShape } from "@/lib/clips/clips";

export async function GET() {
  return Response.json({ clips: listClips() });
}

/**
 * Multipart form: prompt, shape (9:16|16:9), seconds (4-12), model, and optionally thumbnailId or picture (image file).
 * Returns at once; the clip is made in the background (often several minutes: Agnes's free queue is busy).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const prompt = String(form.get("prompt") ?? "").trim();
  if (prompt.length < 5) return Response.json({ error: "Describe the clip (at least a few words)" }, { status: 400 });
  const shape: ClipShape = form.get("shape") === "16:9" ? "16:9" : "9:16";
  const seconds = Number(form.get("seconds") ?? 5) || 5;
  const modelIn = String(form.get("model") ?? "");
  const model: VideoModel = modelIn in VIDEO_MODELS ? (modelIn as VideoModel) : "agnes-video-2.5-flash";
  const thumbnailId = Number(form.get("thumbnailId")) || null;
  const picture = form.get("picture");
  const upload = picture instanceof File && picture.size > 0 ? picture : null;
  if (upload && (upload.size > 10 * 1024 * 1024 || !upload.type.startsWith("image/"))) return Response.json({ error: "Upload an image up to 10 MB" }, { status: 400 });
  try {
    const clip = await createClip({ prompt: prompt.slice(0, 800), shape, seconds, model, thumbnailId, upload });
    after(() => runClip(clip.id));
    return Response.json(clip);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
