import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { composio, runYouTubeTool, youtubeApi } from "@/lib/composio";
import { getDb } from "@/lib/db";
import path from "node:path";
import { getScript } from "@/lib/scripts/store";
import { getProject, videoDir } from "@/lib/studio/store";

const run = promisify(execFile);

/** YouTube category 28 = Science & Technology. */
const CATEGORY_ID = "28";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export type Privacy = "public" | "unlisted" | "private";

export type Upload = {
  scriptId: number;
  videoId: string;
  url: string;
  title: string;
  privacy: Privacy;
  /** Set while YouTube holds the video private until this time. */
  publishAt: string | null;
  /** Time of the render that was uploaded, to spot re-renders after upload. */
  renderAt: string;
  createdAt: string;
  state: "scheduled" | "live" | "private" | "unlisted";
};

type UploadRow = { script_id: number; video_id: string; title: string; privacy: Privacy; publish_at: string | null; render_at: string; created_at: string };

function fromRow(r: UploadRow): Upload {
  const scheduled = r.publish_at !== null && Date.parse(r.publish_at) > Date.now();
  // A scheduled video turns public on its own at publish_at.
  const privacy: Privacy = r.publish_at !== null && !scheduled ? "public" : r.privacy;
  return {
    scriptId: r.script_id,
    videoId: r.video_id,
    url: `https://youtube.com/shorts/${r.video_id}`,
    title: r.title,
    privacy,
    publishAt: scheduled ? r.publish_at : null,
    renderAt: r.render_at,
    createdAt: r.created_at,
    state: scheduled ? "scheduled" : privacy === "public" ? "live" : privacy,
  };
}

export function getUpload(scriptId: number): Upload | null {
  const row = getDb().prepare(`SELECT * FROM uploads WHERE script_id = ?`).get(scriptId) as UploadRow | undefined;
  return row ? fromRow(row) : null;
}

export function listUploads(): Upload[] {
  return (getDb().prepare(`SELECT * FROM uploads ORDER BY COALESCE(publish_at, created_at) DESC`).all() as UploadRow[]).map(fromRow);
}

function loadScript(scriptId: number) {
  const content = getScript(scriptId)?.content;
  if (!content) throw new Error(`Script #${scriptId} not found`);
  return content;
}

/** The final video rendered in the Video studio. */
function getRender(scriptId: number): { filePath: string; duration: number; createdAt: string } | null {
  const p = getProject(scriptId);
  if (!p?.render) return null;
  return { filePath: path.join(videoDir(scriptId), p.render.file), duration: p.render.duration, createdAt: p.render.createdAt };
}

const hashtag = (t: string) => (t.startsWith("#") ? t : `#${t}`).replace(/\s+/g, "");

/** Title, description (story + source links from the script) and hashtags. */
export function publishDefaults(scriptId: number): { title: string; description: string; tags: string[] } {
  const script = loadScript(scriptId);
  const tags = [...new Set([...script.hashtags.map(hashtag), "#Shorts"])];
  return {
    title: script.title.slice(0, 100),
    description: `${script.description}\n\n${tags.join(" ")}`,
    tags: tags.map((t) => t.slice(1)),
  };
}

export type Check = { label: string; ok: boolean; detail?: string };

async function videoSize(file: string): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { timeout: 30_000 });
    const [width, height] = stdout.trim().split(",").map(Number);
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}

/** Everything that must be true before a Short goes to YouTube. */
export async function publishChecks(scriptId: number, input?: { title: string; description: string }): Promise<Check[]> {
  const render = getRender(scriptId);
  const meta = input ?? publishDefaults(scriptId);
  const size = render ? await videoSize(render.filePath) : null;
  const descBytes = Buffer.byteLength(meta.description);
  return [
    { label: "Rendered video", ok: Boolean(render), detail: render ? undefined : "Render it in the Video studio first" },
    { label: "60 seconds or less", ok: Boolean(render && render.duration <= 60), detail: render ? `${render.duration.toFixed(1)}s` : undefined },
    { label: "Vertical 9:16", ok: Boolean(size && size.height > size.width), detail: size ? `${size.width}x${size.height}` : undefined },
    { label: "Title", ok: meta.title.trim().length > 0 && meta.title.length <= 100, detail: `${meta.title.length}/100` },
    { label: "Description", ok: descBytes <= 5000 && !/[<>]/.test(meta.description), detail: descBytes > 5000 ? "Too long" : /[<>]/.test(meta.description) ? "No < or > allowed" : undefined },
  ];
}

/** Composio's upload reply has changed shape between versions, so look for the video id anywhere in it. */
function findVideoId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.kind === "youtube#video" && typeof obj.id === "string") return obj.id;
  for (const key of ["id", "videoId", "video_id"]) if (typeof obj[key] === "string" && /^[\w-]{11}$/.test(obj[key] as string)) return obj[key] as string;
  for (const value of Object.values(obj)) {
    const found = findVideoId(value);
    if (found) return found;
  }
  return null;
}

/** Make a private video public at `publishAt` (YouTube does the switch, so PilotTube can be off). */
async function setSchedule(videoId: string, publishAt: string | null, privacy: Privacy) {
  await youtubeApi("PUT", VIDEOS_URL, { part: "status" }, {
    id: videoId,
    status: publishAt ? { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false } : { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  });
}

export type PublishInput = { title: string; description: string; privacy: Privacy; publishAt: string | null };

/** Upload the rendered Short to YouTube now, or as private with a YouTube-side publish time. */
export async function publishShort(scriptId: number, input: PublishInput): Promise<Upload> {
  if (getUpload(scriptId)) throw new Error("This Short is already on YouTube");
  const failed = (await publishChecks(scriptId, input)).filter((c) => !c.ok);
  if (failed.length) throw new Error(`Fix these first: ${failed.map((c) => c.label).join(", ")}`);
  if (input.publishAt && Date.parse(input.publishAt) < Date.now() + 15 * 60_000) throw new Error("Pick a time at least 15 minutes from now");

  const render = getRender(scriptId)!;
  const { tags } = publishDefaults(scriptId);
  const privacy: Privacy = input.publishAt ? "private" : input.privacy;
  // Stage the MP4 with Composio first; the tool then sends it on to YouTube.
  const videoFile = await composio().files.upload({ file: render.filePath, toolSlug: "YOUTUBE_UPLOAD_VIDEO", toolkitSlug: "youtube" });
  const data = await runYouTubeTool("YOUTUBE_UPLOAD_VIDEO", {
    title: input.title.trim(),
    description: input.description,
    tags,
    categoryId: CATEGORY_ID,
    privacyStatus: privacy,
    videoFilePath: { ...videoFile, name: `pilottube-${scriptId}.mp4`, mimetype: "video/mp4" },
  });
  const videoId = findVideoId(data);
  if (!videoId) throw new Error("YouTube accepted the upload but did not return a video id. Check YouTube Studio.");

  const now = new Date().toISOString();
  getDb()
    .prepare(`INSERT INTO uploads (script_id, video_id, title, privacy, publish_at, render_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(scriptId, videoId, input.title.trim(), privacy, null, render.createdAt, now, now);

  if (input.publishAt) {
    try {
      await reschedule(scriptId, input.publishAt);
    } catch (err) {
      throw new Error(`Uploaded as private, but scheduling failed: ${(err as Error).message}. Set the time again from the Publishing page.`);
    }
  }
  return getUpload(scriptId)!;
}

/** Change (or set) the go-live time of a private video. */
export async function reschedule(scriptId: number, publishAt: string): Promise<Upload> {
  const upload = getUpload(scriptId);
  if (!upload) throw new Error("This Short is not on YouTube yet");
  if (upload.state === "live") throw new Error("This Short is already public");
  if (Date.parse(publishAt) < Date.now() + 15 * 60_000) throw new Error("Pick a time at least 15 minutes from now");
  await setSchedule(upload.videoId, publishAt, "private");
  getDb().prepare(`UPDATE uploads SET privacy = 'private', publish_at = ?, updated_at = ? WHERE script_id = ?`).run(publishAt, new Date().toISOString(), scriptId);
  return getUpload(scriptId)!;
}

/** Make the video public right away (also cancels its schedule), or cancel the schedule and keep it private. */
export async function setVisibility(scriptId: number, privacy: Privacy): Promise<Upload> {
  const upload = getUpload(scriptId);
  if (!upload) throw new Error("This Short is not on YouTube yet");
  await setSchedule(upload.videoId, null, privacy);
  getDb().prepare(`UPDATE uploads SET privacy = ?, publish_at = NULL, updated_at = ? WHERE script_id = ?`).run(privacy, new Date().toISOString(), scriptId);
  return getUpload(scriptId)!;
}

export type VideoNumbers = { views: number; likes: number; comments: number };

let statsCache: { at: number; ids: string; value: Promise<Map<string, VideoNumbers>> } | null = null;

/** Views, likes and comments for uploaded Shorts (1 quota unit per 50 videos, cached 15 minutes). */
export function uploadStats(videoIds: string[]): Promise<Map<string, VideoNumbers>> {
  const ids = [...videoIds].sort().join(",");
  if (!ids) return Promise.resolve(new Map());
  if (statsCache && statsCache.ids === ids && Date.now() - statsCache.at < 15 * 60_000) return statsCache.value;
  const value = runYouTubeTool<{ items?: { id: string; statistics?: Record<string, string> }[] }>("YOUTUBE_GET_VIDEO_DETAILS_BATCH", { id: videoIds, parts: ["statistics"] }).then(
    (data) =>
      new Map(
        (data.items ?? []).map((v) => [
          v.id,
          { views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0), comments: Number(v.statistics?.commentCount ?? 0) },
        ]),
      ),
  );
  statsCache = { at: Date.now(), ids, value };
  value.catch(() => {
    if (statsCache?.value === value) statsCache = null;
  });
  return value;
}
