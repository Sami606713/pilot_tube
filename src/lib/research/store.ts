import "server-only";
import { getDb } from "@/lib/db";
import { STEP_LABELS, type Depth, type Research, type ResearchResult, type ResearchSummary, type Step, type StepKey, type TimeRange } from "./types";

type Row = {
  id: number;
  topic: string;
  time_range: TimeRange;
  depth: Depth;
  status: Research["status"];
  steps: string;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

/** A run that hasn't reported progress for this long was cut off (e.g. the dev server restarted). */
const STALE_MS = 10 * 60_000;

function fromRow(r: Row): Research {
  const research: Research = {
    id: r.id,
    topic: r.topic,
    timeRange: r.time_range,
    depth: r.depth,
    status: r.status,
    steps: JSON.parse(r.steps) as Step[],
    result: r.result ? (JSON.parse(r.result) as ResearchResult) : null,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (research.status === "running" && Date.now() - Date.parse(research.updatedAt) > STALE_MS) {
    failResearch(research.id, "The research stopped (the server restarted or it timed out). Run it again.");
    return getResearch(research.id)!;
  }
  return research;
}

export function createResearch(topic: string, timeRange: TimeRange, depth: Depth): number {
  const steps: Step[] = (Object.keys(STEP_LABELS) as StepKey[]).map((key) => ({
    key,
    label: STEP_LABELS[key],
    state: key === "gaps" && depth === "quick" ? "skipped" : "waiting",
  }));
  const now = new Date().toISOString();
  const { lastInsertRowid } = getDb()
    .prepare(`INSERT INTO research (topic, time_range, depth, status, steps, created_at, updated_at) VALUES (?, ?, ?, 'running', ?, ?, ?)`)
    .run(topic, timeRange, depth, JSON.stringify(steps), now, now);
  return Number(lastInsertRowid);
}

export function getResearch(id: number): Research | null {
  const row = getDb().prepare(`SELECT * FROM research WHERE id = ?`).get(id) as Row | undefined;
  return row ? fromRow(row) : null;
}

export function listResearch(limit = 50): ResearchSummary[] {
  const rows = getDb().prepare(`SELECT * FROM research ORDER BY id DESC LIMIT ?`).all(limit) as Row[];
  return rows.map(fromRow).map((r) => ({
    id: r.id,
    topic: r.topic,
    status: r.status,
    depth: r.depth,
    createdAt: r.createdAt,
    title: r.result?.title ?? null,
    score: r.result?.score ?? null,
  }));
}

export function updateStep(id: number, key: StepKey, state: Step["state"], detail?: string) {
  const research = getResearch(id);
  if (!research) return;
  const steps = research.steps.map((s) => (s.key === key ? { ...s, state, detail: detail ?? s.detail } : s));
  getDb().prepare(`UPDATE research SET steps = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(steps), new Date().toISOString(), id);
}

export function finishResearch(id: number, result: ResearchResult) {
  getDb()
    .prepare(`UPDATE research SET status = 'done', result = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(result), new Date().toISOString(), id);
}

export function failResearch(id: number, error: string) {
  const row = getDb().prepare(`SELECT steps FROM research WHERE id = ?`).get(id) as { steps: string } | undefined;
  if (!row) return;
  const steps = (JSON.parse(row.steps) as Step[]).map((s) => (s.state === "running" ? { ...s, state: "failed" as const } : s));
  getDb()
    .prepare(`UPDATE research SET status = 'failed', error = ?, steps = ?, updated_at = ? WHERE id = ?`)
    .run(error, JSON.stringify(steps), new Date().toISOString(), id);
}

export function deleteResearch(id: number) {
  getDb().prepare(`DELETE FROM research WHERE id = ?`).run(id);
}
