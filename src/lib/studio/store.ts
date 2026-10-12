import "server-only";
import path from "node:path";
import { getDb } from "@/lib/db";
import { STUDIO_STEP_LABELS, DEFAULT_ACCENT, type StudioStep, type StudioStepKey, type VideoProject } from "./types";

type Row = { script_id: number; data: string; updated_at: string };

/** Voice/visuals take a few minutes and render up to ~10; longer silence means the run died. */
const STALE_MS = 20 * 60_000;

export function videoDir(scriptId: number): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data", "videos", String(scriptId));
}

export function getProject(scriptId: number): VideoProject | null {
  const row = getDb().prepare(`SELECT * FROM videos WHERE script_id = ?`).get(scriptId) as Row | undefined;
  if (!row) return null;
  const p = JSON.parse(row.data) as VideoProject;
  if ((p.status === "running" || p.status === "rendering") && Date.now() - Date.parse(p.updatedAt) > STALE_MS) {
    const steps = p.steps.map((s) => (s.state === "running" ? { ...s, state: "failed" as const } : s));
    return saveProject({ ...p, steps, status: p.lines.length ? "ready" : "failed", error: "The run stopped (the server restarted or it timed out). Try again." });
  }
  return p;
}

export function saveProject(p: VideoProject): VideoProject {
  const next = { ...p, updatedAt: new Date().toISOString() };
  getDb().prepare(`INSERT OR REPLACE INTO videos (script_id, data, updated_at) VALUES (?, ?, ?)`).run(p.scriptId, JSON.stringify(next), next.updatedAt);
  return next;
}

export function newProject(scriptId: number, title: string): VideoProject {
  const now = new Date().toISOString();
  const steps: StudioStep[] = (Object.keys(STUDIO_STEP_LABELS) as StudioStepKey[]).map((key) => ({
    key,
    label: STUDIO_STEP_LABELS[key],
    state: "waiting",
  }));
  return saveProject({ scriptId, title, status: "running", steps, accent: DEFAULT_ACCENT, brand: null, sfxEnabled: true, voice: null, lines: [], render: null, editedAt: now, error: null, createdAt: now, updatedAt: now });
}

export function setStep(scriptId: number, key: StudioStepKey, state: StudioStep["state"], detail?: string): VideoProject | null {
  const p = getProject(scriptId);
  if (!p) return null;
  return saveProject({ ...p, steps: p.steps.map((s) => (s.key === key ? { ...s, state, detail: detail ?? s.detail } : s)) });
}

/** Pexels ids used by other videos, so Shorts don't reuse the same footage. */
export function usedPexelsIds(exceptScriptId: number): Set<number> {
  const rows = getDb().prepare(`SELECT data FROM videos WHERE script_id != ?`).all(exceptScriptId) as { data: string }[];
  const ids = new Set<number>();
  for (const r of rows) for (const l of (JSON.parse(r.data) as VideoProject).lines) if (l.chosen) ids.add(l.chosen);
  return ids;
}

export function listProjects(): { scriptId: number; title: string; status: VideoProject["status"]; rendered: boolean; updatedAt: string }[] {
  const rows = getDb().prepare(`SELECT data FROM videos ORDER BY updated_at DESC`).all() as { data: string }[];
  return rows.map((r) => {
    const p = JSON.parse(r.data) as VideoProject;
    return { scriptId: p.scriptId, title: p.title, status: p.status, rendered: Boolean(p.render), updatedAt: p.updatedAt };
  });
}

