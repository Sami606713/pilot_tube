import "server-only";
import { getDb } from "@/lib/db";
import { SCRIPT_STEP_LABELS, seconds, totalWords, type Script, type ScriptContent, type ScriptStep, type ScriptStepKey, type ScriptSummary } from "./types";

type Row = {
  id: number;
  research_id: number | null;
  topic: string;
  status: Script["status"];
  steps: string;
  content: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

/** Research + script can take ~10 min on a rate-limited key; silence longer than this means the run died. */
const STALE_MS = 15 * 60_000;

function fromRow(r: Row): Script {
  const script: Script = {
    id: r.id,
    researchId: r.research_id,
    topic: r.topic,
    status: r.status,
    steps: JSON.parse(r.steps) as ScriptStep[],
    content: r.content ? (JSON.parse(r.content) as ScriptContent) : null,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (script.status === "running" && Date.now() - Date.parse(script.updatedAt) > STALE_MS) {
    failScript(script.id, "The script run stopped (the server restarted or it timed out). Try again.");
    return getScript(script.id)!;
  }
  return script;
}

/** `withResearch` adds the research step (custom topic: research runs first). */
export function createScript(topic: string, researchId: number | null, withResearch: boolean): number {
  const steps: ScriptStep[] = (Object.keys(SCRIPT_STEP_LABELS) as ScriptStepKey[]).map((key) => ({
    key,
    label: SCRIPT_STEP_LABELS[key],
    state: key === "research" && !withResearch ? "skipped" : "waiting",
  }));
  const now = new Date().toISOString();
  const { lastInsertRowid } = getDb()
    .prepare(`INSERT INTO scripts (research_id, topic, status, steps, created_at, updated_at) VALUES (?, ?, 'running', ?, ?, ?)`)
    .run(researchId, topic, JSON.stringify(steps), now, now);
  return Number(lastInsertRowid);
}

export function getScript(id: number): Script | null {
  const row = getDb().prepare(`SELECT * FROM scripts WHERE id = ?`).get(id) as Row | undefined;
  return row ? fromRow(row) : null;
}

export function listScripts(limit = 100): ScriptSummary[] {
  const rows = getDb().prepare(`SELECT * FROM scripts ORDER BY id DESC LIMIT ?`).all(limit) as Row[];
  return rows.map(fromRow).map((s) => ({
    id: s.id,
    topic: s.topic,
    status: s.status,
    createdAt: s.createdAt,
    title: s.content?.title ?? null,
    overall: s.content?.scores.overall ?? null,
    seconds: s.content ? seconds(totalWords(s.content.lines)) : null,
  }));
}

export function setResearchId(id: number, researchId: number) {
  getDb().prepare(`UPDATE scripts SET research_id = ?, updated_at = ? WHERE id = ?`).run(researchId, new Date().toISOString(), id);
}

export function updateScriptStep(id: number, key: ScriptStepKey, state: ScriptStep["state"], detail?: string) {
  const script = getScript(id);
  if (!script) return;
  const steps = script.steps.map((s) => (s.key === key ? { ...s, state, detail: detail ?? s.detail } : s));
  getDb().prepare(`UPDATE scripts SET steps = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(steps), new Date().toISOString(), id);
}

/** Keeps a running script alive while a long sub-task (research) reports elsewhere. */
export function touchScript(id: number) {
  getDb().prepare(`UPDATE scripts SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}

export function saveScriptContent(id: number, content: ScriptContent, status: Script["status"] = "done") {
  getDb()
    .prepare(`UPDATE scripts SET status = ?, content = ?, error = NULL, updated_at = ? WHERE id = ?`)
    .run(status, JSON.stringify(content), new Date().toISOString(), id);
}

export function failScript(id: number, error: string) {
  const row = getDb().prepare(`SELECT steps FROM scripts WHERE id = ?`).get(id) as { steps: string } | undefined;
  if (!row) return;
  const steps = (JSON.parse(row.steps) as ScriptStep[]).map((s) => (s.state === "running" ? { ...s, state: "failed" as const } : s));
  getDb()
    .prepare(`UPDATE scripts SET status = 'failed', error = ?, steps = ?, updated_at = ? WHERE id = ?`)
    .run(error, JSON.stringify(steps), new Date().toISOString(), id);
}

export function deleteScript(id: number) {
  getDb().prepare(`DELETE FROM scripts WHERE id = ?`).run(id);
}
