import "server-only";
import { getDb } from "@/lib/db";
import { getUpload, listUploads, publishDefaults, publishShort, type Upload } from "@/lib/publish/youtube";
import { getResearch } from "@/lib/research/store";
import { createScript, getScript } from "@/lib/scripts/store";
import { getProject } from "@/lib/studio/store";

/** One Short a day: what is planned for each date, and how far it has got. */
export type Stage = "empty" | "topic" | "writing" | "script" | "video" | "scheduled" | "published" | "failed";

export type DayPlan = {
  day: string;
  stage: Stage;
  title: string | null;
  topic: string | null;
  researchId: number | null;
  scriptId: number | null;
  /** Rendered video length (seconds), when there is one. */
  duration: number | null;
  upload: Pick<Upload, "videoId" | "url" | "state" | "publishAt"> | null;
  /** Less than 24h to the post time and no finished video yet. */
  urgent: boolean;
  /** True when the day shows an upload that was not planned here (made from Publishing). */
  external: boolean;
};

type SlotRow = { day: string; topic: string | null; research_id: number | null; script_id: number | null };

const DEFAULT_POST_TIME = "18:00";

export function getPostTime(): string {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = 'post_time'`).get() as { value: string } | undefined;
  return row?.value ?? DEFAULT_POST_TIME;
}

export function setPostTime(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Use a time like 18:00");
  getDb().prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('post_time', ?)`).run(time);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar date (the server's time zone is the channel's). */
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The Monday on or before a date. */
export function weekStart(day?: string | null): string {
  const d = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00`) : new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

/** The day's go-live moment, as an ISO string. */
export function postMoment(day: string): string {
  return new Date(`${day}T${getPostTime()}:00`).toISOString();
}

function slot(day: string): SlotRow | undefined {
  return getDb().prepare(`SELECT * FROM plan_slots WHERE day = ?`).get(day) as SlotRow | undefined;
}

export function getWeek(start: string): DayPlan[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  // Uploads made from the Publishing page still show on their go-live day.
  const uploads = listUploads();
  const uploadDay = (u: Upload) => localDay(new Date(u.publishAt ?? u.createdAt));
  return days.map((day) => {
    const s = slot(day);
    const script = s?.script_id ? getScript(s.script_id) : null;
    const project = s?.script_id ? getProject(s.script_id) : null;
    const planned = s?.script_id ? getUpload(s.script_id) : null;
    const other = !s ? uploads.find((u) => uploadDay(u) === day) : undefined;
    const upload = planned ?? other ?? null;
    const research = s?.research_id ? getResearch(s.research_id) : null;

    let stage: Stage = "empty";
    if (upload) stage = upload.state === "scheduled" ? "scheduled" : "published";
    else if (project?.render) stage = "video";
    else if (script?.status === "done") stage = "script";
    else if (script?.status === "running") stage = "writing";
    else if (script?.status === "failed") stage = "failed";
    else if (s) stage = "topic";

    const ready = stage === "video" || stage === "scheduled" || stage === "published";
    const until = Date.parse(postMoment(day)) - Date.now();
    const otherScript = other ? getScript(other.scriptId) : null;
    return {
      day,
      stage,
      title: script?.content?.title ?? otherScript?.content?.title ?? other?.title ?? research?.result?.title ?? s?.topic ?? null,
      topic: s?.topic ?? null,
      researchId: s?.research_id ?? null,
      scriptId: s?.script_id ?? other?.scriptId ?? null,
      duration: project?.render?.duration ?? null,
      upload: upload ? { videoId: upload.videoId, url: upload.url, state: upload.state, publishAt: upload.publishAt } : null,
      urgent: !ready && until > 0 && until < 24 * 3600_000,
      external: Boolean(other),
    };
  });
}

/** Plan a day with a topic, a finished research, or a finished script. */
export function planDay(day: string, input: { topic?: string; researchId?: number; scriptId?: number }) {
  if (slot(day)) throw new Error("That day already has a plan. Remove it first.");
  let topic = input.topic?.trim() || null;
  let researchId = input.researchId ?? null;
  const scriptId = input.scriptId ?? null;
  if (scriptId) {
    const s = getScript(scriptId);
    if (!s?.content) throw new Error("That script is not finished");
    topic = s.content.title;
    researchId = s.researchId;
  } else if (researchId) {
    const r = getResearch(researchId);
    if (!r?.result) throw new Error("That research is not finished");
    topic = r.result.title;
  } else if (!topic || topic.length < 3) throw new Error("Type a topic, or pick a research or script");
  getDb().prepare(`INSERT INTO plan_slots (day, topic, research_id, script_id, created_at) VALUES (?, ?, ?, ?, ?)`).run(day, topic, researchId, scriptId, new Date().toISOString());
}

export function moveDay(from: string, to: string) {
  if (!slot(from)) throw new Error("Nothing planned on that day");
  if (slot(to)) throw new Error("The new day already has a plan");
  getDb().prepare(`UPDATE plan_slots SET day = ? WHERE day = ?`).run(to, from);
}

export function clearDay(day: string) {
  getDb().prepare(`DELETE FROM plan_slots WHERE day = ?`).run(day);
}

/** Start the script for a planned day (research runs first for a typed topic). Returns the script id; caller runs it. */
export function startScriptForDay(day: string): { scriptId: number; researchId: number | null; topic: string } {
  const s = slot(day);
  if (!s) throw new Error("Nothing planned on that day");
  if (s.script_id && getScript(s.script_id)?.status !== "failed") throw new Error("This day already has a script");
  const topic = s.topic ?? "AI news";
  const scriptId = createScript(topic, s.research_id, !s.research_id);
  getDb().prepare(`UPDATE plan_slots SET script_id = ? WHERE day = ?`).run(scriptId, day);
  return { scriptId, researchId: s.research_id, topic };
}

/** Upload the day's video to YouTube, set to go live at the day's post time. */
export async function scheduleDay(day: string) {
  const s = slot(day);
  if (!s?.script_id) throw new Error("This day has no script yet");
  const when = postMoment(day);
  if (Date.parse(when) < Date.now() + 15 * 60_000) throw new Error("The post time has passed (or is under 15 minutes away). Publish it from the Publishing page instead.");
  const d = publishDefaults(s.script_id);
  return publishShort(s.script_id, { title: d.title, description: d.description, privacy: "public", publishAt: when });
}
