"use client";

import {
  ArrowClockwise,
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Copy,
  DownloadSimple,
  FilmSlate,
  MusicNote,
  PencilSimple,
  Sparkle,
  TextAa,
  Trash,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Elapsed, RunSteps } from "@/components/run-steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FactStatus } from "@/lib/research/types";
import {
  PARTS,
  TRANSITIONS,
  UNCHECKED,
  VISUALS,
  lineTimes,
  seconds,
  totalWords,
  wordCount,
  type Script,
  type ScriptContent,
  type ScriptLine,
  type Transition,
  type VisualType,
} from "@/lib/scripts/types";
import { cn } from "@/lib/utils";

export type FactInfo = { id: string; statement: string; status: FactStatus; sources: string[] };

const PART_TONE: Record<ScriptLine["part"], string> = {
  hook: "text-brand",
  setup: "text-sky-400",
  tension: "text-amber-400",
  reveal: "text-success",
  why: "text-violet-400",
  loop: "text-pink-400",
};

const scoreTone = (n: number) => (n >= 8 ? "text-success" : n >= 6.5 ? "text-amber-400" : "text-destructive");
const field = "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(c: ScriptContent): string {
  const times = lineTimes(c.lines);
  const head = ["#", "Start", "Part", "Narration", "Visual type", "Visual", "On-screen text", "Transition", "SFX", "Facts"];
  const rows = c.lines.map((l, i) => [String(i + 1), times[i], PARTS[l.part], l.narration, VISUALS[l.visual.type], l.visual.description, l.onScreenText, TRANSITIONS[l.transition], l.sfx, l.facts.join(" ")]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

function toText(c: ScriptContent): string {
  const times = lineTimes(c.lines);
  return [
    c.title,
    "",
    ...c.lines.map(
      (l, i) =>
        `${i + 1}. [${times[i]}] ${PARTS[l.part].toUpperCase()}\n   VO: ${l.narration}\n   VISUAL (${VISUALS[l.visual.type]}): ${l.visual.description}\n   TEXT: ${l.onScreenText || "-"} | TRANSITION: ${TRANSITIONS[l.transition]} | SFX: ${l.sfx || "-"}`,
    ),
    "",
    "DESCRIPTION",
    c.description,
    "",
    c.hashtags.join(" "),
  ].join("\n");
}

function download(name: string, body: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Cue({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs" title={label}>
      <span className="text-subtle">{icon}</span>
      {children}
    </span>
  );
}

export function ScriptView({ initial, facts }: { initial: Script; facts: Record<string, FactInfo> }) {
  const router = useRouter();
  const [script, setScript] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ScriptContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState<number | null>(null);
  const [rewriteOpen, setRewriteOpen] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [openFacts, setOpenFacts] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Poll while the script (and its research) is being written.
  const load = useCallback(async () => {
    const res = await fetch(`/api/scripts/${script.id}`);
    if (res.ok) setScript(await res.json());
  }, [script.id]);
  useEffect(() => {
    if (script.status !== "running") return;
    const t = setTimeout(load, 2500);
    return () => clearTimeout(t);
  }, [script, load]);
  // Facts come from the research, which the server page loads: refresh it once the script is done.
  const finished = script.status === "done" && initial.status !== "done";
  useEffect(() => {
    if (finished) router.refresh();
  }, [finished, router]);

  async function remove() {
    if (!window.confirm("Delete this script?")) return;
    await fetch(`/api/scripts/${script.id}`, { method: "DELETE" });
    router.push("/shorts");
    router.refresh();
  }

  async function retry() {
    const body = script.researchId ? { researchId: script.researchId } : { topic: script.topic };
    const res = await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) router.push(`/shorts/${data.id}`);
    else setError(data.error ?? "Could not start again");
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          hashtags: draft.hashtags,
          lines: draft.lines.map(({ narration, visual, onScreenText, transition, sfx }) => ({ narration, visual, onScreenText, transition, sfx })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setScript(data);
      setEditing(false);
      setDraft(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function rewrite(index: number) {
    setRewriting(index);
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${script.id}/line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rewrite failed");
      setScript(data);
      setRewriteOpen(null);
      setInstruction("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRewriting(null);
    }
  }

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  // ----- Running / failed -----
  if (script.status !== "done" || !script.content) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>{script.topic}</span>
            {script.status === "running" && (
              <span className="text-xs font-normal text-muted-foreground">
                Writing <Elapsed since={script.createdAt} />
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <RunSteps steps={script.steps} skippedNote="from finished research" />
          {script.status === "running" && <p className="text-xs text-muted-foreground">You can leave this page; it keeps running and appears in Scripts.</p>}
          {script.status === "failed" && (
            <div className="flex flex-col items-start gap-3">
              <p className="flex items-start gap-1.5 text-sm text-destructive">
                <Warning className="mt-0.5 size-4 shrink-0" /> {script.error}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={retry}>
                  <ArrowClockwise /> Try again
                </Button>
                <Button variant="ghost" onClick={remove}>
                  <Trash /> Delete
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ----- Finished -----
  const c = editing && draft ? draft : script.content;
  const words = totalWords(c.lines);
  const secs = seconds(words);
  const times = lineTimes(c.lines);
  const s = script.content.scores;
  const setLine = (i: number, patch: Partial<ScriptLine>) => setDraft((d) => (d ? { ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : d));
  const flagged = script.content.lines.filter((l) => !l.check.ok).length;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-balance md:text-2xl">{script.content.title}</h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("font-mono tabular-nums", secs > 58.5 ? "text-destructive" : secs < 49 ? "text-amber-400" : "text-foreground")}>
              {secs.toFixed(1)}s
            </span>
            <span>
              {words} words · {c.lines.length} lines
            </span>
            {script.researchId && (
              <Link href={`/research?id=${script.researchId}`} className="underline decoration-border-strong underline-offset-2 hover:text-foreground">
                Research #{script.researchId}
              </Link>
            )}
            {script.content.edited && <span className="text-amber-400">Edited by hand</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {editing ? (
            <>
              <Button onClick={save} disabled={saving}>
                {saving ? <CircleNotch className="animate-spin" /> : <CheckCircle />} Save
              </Button>
              <Button variant="ghost" onClick={() => (setEditing(false), setDraft(null))} disabled={saving}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => (setDraft(structuredClone(script.content!)), setEditing(true))}>
                <PencilSimple /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => copy("vo", c.lines.map((l) => l.narration).join("\n"))}>
                <Copy /> {copied === "vo" ? "Copied" : "Voice-over"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => download(`script-${script.id}.csv`, toCsv(c), "text/csv")}>
                <DownloadSimple /> CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => download(`script-${script.id}.txt`, toText(c), "text/plain")}>
                <DownloadSimple /> .txt
              </Button>
              <Button variant="ghost" size="sm" onClick={remove} aria-label="Delete script">
                <Trash />
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <Warning className="size-4" /> {error}
        </p>
      )}

      {/* Scores */}
      <section className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <div className="col-span-3 flex flex-col justify-center rounded-xl border border-border bg-card p-4 sm:col-span-1">
          <span className={cn("font-mono text-3xl font-semibold tabular-nums", scoreTone(s.overall))}>{s.overall.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">Script score</span>
        </div>
        {(["hook", "story", "accuracy", "pacing", "loop"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span className={cn("font-mono text-xl font-semibold tabular-nums", scoreTone(s[k]))}>{s[k]}</span>
            <span className="text-xs text-muted-foreground capitalize">{k}</span>
          </div>
        ))}
      </section>
      {(s.notes.length > 0 || flagged > 0 || script.content.edited) && (
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {script.content.edited && <p className="text-amber-400">Scores are from before your edits.</p>}
          {flagged > 0 && <p className="text-amber-400">{flagged} line{flagged > 1 ? "s are" : " is"} not fully supported by the research: see the warnings below.</p>}
          {s.notes.length > 0 && (
            <details>
              <summary className="w-fit cursor-pointer hover:text-foreground">Editor notes ({s.notes.length})</summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {s.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Hooks */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Hooks</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {script.content.hooks.map((h, i) => (
            <div key={i} className={cn("flex flex-col gap-2 rounded-xl border p-4", i === script.content!.chosenHook ? "border-brand/50 bg-brand-soft" : "border-border")}>
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{h.style}</span>
                <span className="font-mono tabular-nums">{i === script.content!.chosenHook ? "Used · " : ""}{h.score}/10</span>
              </span>
              <p className="text-sm font-medium">&ldquo;{h.text}&rdquo;</p>
              {h.why && <p className="text-xs text-muted-foreground">{h.why}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Lines */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Script and edit cues</h3>
        <ol className="flex flex-col gap-3">
          {c.lines.map((l, i) => {
            const lineFacts = l.facts.map((id) => facts[id]).filter(Boolean);
            const unchecked = l.check.ok && l.check.note === UNCHECKED;
            return (
              <li key={i} className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[4.5rem_minmax(0,1fr)]">
                <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-1">
                  <span className="font-mono text-sm tabular-nums">{times[i]}</span>
                  <span className={cn("text-xs font-medium", PART_TONE[l.part])}>{PARTS[l.part]}</span>
                  <span className="font-mono text-[11px] text-subtle tabular-nums">{wordCount(l.narration)}w</span>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  {editing ? (
                    <textarea value={l.narration} onChange={(e) => setLine(i, { narration: e.target.value })} rows={2} className={cn(field, "text-base")} aria-label={`Line ${i + 1} narration`} />
                  ) : (
                    <p className="text-base leading-relaxed">{l.narration}</p>
                  )}

                  {editing ? (
                    <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <select value={l.visual.type} onChange={(e) => setLine(i, { visual: { ...l.visual, type: e.target.value as VisualType } })} className={field} aria-label="Visual type">
                        {Object.entries(VISUALS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <textarea value={l.visual.description} onChange={(e) => setLine(i, { visual: { ...l.visual, description: e.target.value } })} rows={2} className={field} aria-label="Visual" />
                      <Input value={l.onScreenText} onChange={(e) => setLine(i, { onScreenText: e.target.value })} placeholder="On-screen text" aria-label="On-screen text" />
                      <div className="grid grid-cols-2 gap-2">
                        <select value={l.transition} onChange={(e) => setLine(i, { transition: e.target.value as Transition })} className={field} aria-label="Transition">
                          {Object.entries(TRANSITIONS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <Input value={l.sfx} onChange={(e) => setLine(i, { sfx: e.target.value })} placeholder="SFX" aria-label="Sound effect" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="flex gap-2 text-sm text-muted-foreground">
                        <FilmSlate className="mt-0.5 size-4 shrink-0 text-subtle" />
                        <span>
                          <span className="font-medium text-foreground">{VISUALS[l.visual.type]}:</span> {l.visual.description}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {l.onScreenText && (
                          <Cue icon={<TextAa className="size-3.5" />} label="On-screen text">
                            <span className="font-semibold tracking-wide uppercase">{l.onScreenText}</span>
                          </Cue>
                        )}
                        {i < c.lines.length - 1 && (
                          <Cue icon={<ArrowsClockwise className="size-3.5" />} label="Transition to the next line">
                            {TRANSITIONS[l.transition]}
                          </Cue>
                        )}
                        {l.sfx && (
                          <Cue icon={<MusicNote className="size-3.5" />} label="Sound effect">
                            {l.sfx}
                          </Cue>
                        )}
                      </div>
                    </>
                  )}

                  {!editing && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                      {!l.check.ok ? (
                        <span className="flex items-start gap-1.5 text-amber-400">
                          <WarningCircle weight="fill" className="mt-px size-3.5 shrink-0" /> {l.check.note}
                        </span>
                      ) : unchecked ? (
                        <span className="text-muted-foreground">{UNCHECKED}</span>
                      ) : lineFacts.length > 0 ? (
                        <button type="button" onClick={() => setOpenFacts(openFacts === i ? null : i)} className="flex items-center gap-1.5 text-success hover:underline">
                          <CheckCircle weight="fill" className="size-3.5" /> Backed by {lineFacts.length} fact{lineFacts.length > 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle className="size-3.5" /> Checked: supported
                        </span>
                      )}
                      <button type="button" onClick={() => setRewriteOpen(rewriteOpen === i ? null : i)} className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Sparkle className="size-3.5" /> Rewrite
                      </button>
                    </div>
                  )}

                  {openFacts === i && lineFacts.length > 0 && (
                    <ul className="flex flex-col gap-1.5 border-l-2 border-success/40 pl-3 text-xs text-muted-foreground">
                      {lineFacts.map((f) => (
                        <li key={f.id}>
                          <span className="font-medium text-foreground">{f.status === "confirmed" ? "Confirmed" : "Single source"}:</span> {f.statement}{" "}
                          <span className="text-subtle">({f.sources.join(", ")})</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {rewriteOpen === i && !editing && (
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        rewrite(i);
                      }}
                    >
                      <Input
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Optional: how? e.g. more dramatic, simpler words, shorter"
                        aria-label="Rewrite instruction"
                        autoFocus
                      />
                      <Button type="submit" size="sm" className="h-8 shrink-0" disabled={rewriting !== null}>
                        {rewriting === i ? <CircleNotch className="animate-spin" /> : <Sparkle />} Rewrite line
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* YouTube details */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">YouTube details</h3>
        <Card>
          <CardContent className="flex flex-col gap-4">
            {editing && draft ? (
              <>
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Title ({draft.title.length}/100)
                  <Input value={draft.title} maxLength={100} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Description
                  <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={8} className={field} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  Hashtags (space separated)
                  <Input value={draft.hashtags.join(" ")} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/\s+/).filter(Boolean) })} />
                </label>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{c.title}</p>
                  <Button variant="ghost" size="sm" onClick={() => copy("title", c.title)}>
                    <Copy /> {copied === "title" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">{c.description}</p>
                  <Button variant="ghost" size="sm" onClick={() => copy("desc", `${c.description}\n\n${c.hashtags.join(" ")}`)}>
                    <Copy /> {copied === "desc" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-sm text-brand">{c.hashtags.join(" ")}</p>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
