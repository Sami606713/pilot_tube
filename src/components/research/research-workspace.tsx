"use client";

import {
  ArrowClockwise,
  CircleNotch,
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { researchMarkdown } from "@/lib/research/markdown";
import { DEPTHS, TIME_RANGES, type Depth, type Research, type ResearchSummary, type Score, type TimeRange } from "@/lib/research/types";
import { cn } from "@/lib/utils";
import { ago, Elapsed, RunSteps } from "@/components/run-steps";
import { ReportView } from "./report-view";

const SCORE_STYLE: Record<Score["label"], string> = {
  Strong: "bg-success/15 text-success",
  OK: "bg-amber-400/15 text-amber-400",
  Weak: "bg-destructive/15 text-destructive",
};

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-lg border border-border p-0.5">
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onChange(k)}
            className={cn("rounded-md px-3 py-1 text-sm transition-colors", value === k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResearchWorkspace({ initialHistory, initialId }: { initialHistory: ResearchSummary[]; initialId: number | null }) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [selectedId, setSelectedId] = useState<number | null>(initialId ?? initialHistory[0]?.id ?? null);
  const [current, setCurrent] = useState<Research | null>(null);
  const [topic, setTopic] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [depth, setDepth] = useState<Depth>("deep");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshHistory = useCallback(async () => {
    const res = await fetch("/api/research");
    if (res.ok) setHistory((await res.json()).research);
  }, []);

  const select = useCallback(
    (id: number | null) => {
      setSelectedId(id);
      router.replace(id ? `/research?id=${id}` : "/research", { scroll: false });
    },
    [router],
  );

  // Load the selected research, and poll it while it runs.
  useEffect(() => {
    if (selectedId === null) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const res = await fetch(`/api/research/${selectedId}`);
      if (stop) return;
      if (!res.ok) {
        setCurrent(null);
        return;
      }
      const r = (await res.json()) as Research;
      setCurrent(r);
      if (r.status === "running") timer = setTimeout(load, 2500);
      else refreshHistory();
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [selectedId, refreshHistory]);

  async function start(body: { topic: string; timeRange: TimeRange; depth: Depth }) {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setCurrent(null);
      select(data.id);
      refreshHistory();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this research?")) return;
    await fetch(`/api/research/${id}`, { method: "DELETE" });
    const rest = history.filter((h) => h.id !== id);
    setHistory(rest);
    setCurrent(null);
    select(rest[0]?.id ?? null);
  }

  function download(r: Research) {
    const blob = new Blob([researchMarkdown(r)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(r.result?.title ?? r.topic).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "research"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy(r: Research) {
    await navigator.clipboard.writeText(researchMarkdown(r));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shown = current && current.id === selectedId ? current : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (topic.trim()) start({ topic, timeRange, depth });
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="A topic (e.g. Microsoft Maia 300 chip) or a link to an article"
                  aria-label="Research topic or link"
                  className="h-10 pl-9"
                  maxLength={300}
                />
              </div>
              <Button type="submit" size="lg" className="h-10 px-4" disabled={starting || topic.trim().length < 3}>
                {starting ? <CircleNotch className="animate-spin" /> : <MagnifyingGlass />} Research
              </Button>
            </div>
            <div className="flex flex-wrap gap-6">
              <Segmented label="Time range" value={timeRange} options={TIME_RANGES} onChange={setTimeRange} />
              <div className="flex flex-col gap-1.5">
                <Segmented label="Depth" value={depth} options={{ quick: DEPTHS.quick.label, deep: DEPTHS.deep.label }} onChange={setDepth} />
              </div>
              <p className="self-end pb-1.5 text-xs text-muted-foreground">{DEPTHS[depth].hint}</p>
            </div>
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                <Warning className="size-4" /> {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          {selectedId === null ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <MagnifyingGlass className="size-5" />
                </span>
                <p className="font-medium">Research any AI story, with proof</p>
                <p className="max-w-[65ch] text-sm text-muted-foreground">
                  PilotTube breaks the topic into questions, searches the web, reads the best sources in full, keeps only facts it can quote word for word, cross-checks
                  them, and writes a cited report with an evidence score.
                </p>
              </CardContent>
            </Card>
          ) : !shown ? (
            <div className="skeleton h-96 rounded-xl" aria-busy="true" />
          ) : shown.status !== "done" || !shown.result ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span className="min-w-0">{shown.topic}</span>
                  {shown.status === "running" && (
                    <span className="text-xs font-normal text-muted-foreground">
                      Running <Elapsed since={shown.createdAt} />
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <RunSteps steps={shown.steps} skippedNote="Quick: skipped" />
                {shown.status === "running" && (
                  <p className="text-xs text-muted-foreground">You can leave this page; the research keeps running and shows up in History.</p>
                )}
                {shown.status === "failed" && (
                  <div className="flex flex-col items-start gap-3">
                    <p className="flex items-start gap-1.5 text-sm text-destructive">
                      <Warning className="mt-0.5 size-4 shrink-0" /> {shown.error}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => start({ topic: shown.topic, timeRange: shown.timeRange, depth: shown.depth })}>
                        <ArrowClockwise /> Try again
                      </Button>
                      <Button variant="ghost" onClick={() => remove(shown.id)}>
                        <Trash /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 border-b border-border pb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h2 className="text-xl font-semibold tracking-tight text-balance">{shown.result.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      &ldquo;{shown.topic}&rdquo; · {TIME_RANGES[shown.timeRange]} · {DEPTHS[shown.depth].label} · {ago(shown.createdAt)}
                    </p>
                  </div>
                  <div className={cn("flex shrink-0 items-baseline gap-1.5 rounded-xl px-3 py-2", SCORE_STYLE[shown.result.score.label])}>
                    <span className="font-mono text-2xl font-semibold tabular-nums">{shown.result.score.value}</span>
                    <span className="text-xs">/ 100 · {shown.result.score.label} evidence</span>
                  </div>
                </div>
                {!shown.result.isAI && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-400">
                    <Warning className="size-4 shrink-0" /> This topic doesn&apos;t look like AI news, and the channel covers AI only.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {shown.result.stats.read} sources read · {shown.result.facts.length} facts · {shown.result.stats.quotesRejected} unproven quotes dropped ·{" "}
                    {shown.result.stats.searches} searches · {shown.result.stats.seconds}s · ~{shown.result.stats.credits} Tavily credits
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copy(shown)}>
                      <Copy /> {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => download(shown)}>
                      <DownloadSimple /> .md
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(shown.id)} aria-label="Delete research">
                      <Trash />
                    </Button>
                  </div>
                </div>
                <details className="text-xs text-muted-foreground">
                  <summary className="w-fit cursor-pointer hover:text-foreground">Why this score</summary>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                    {shown.result.score.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </details>
              </div>
              <ReportView result={shown.result} />
            </div>
          )}
        </div>

        <aside className="xl:col-span-3">
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClockCounterClockwise className="size-4 text-subtle" /> History
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              {history.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">No research yet.</p>
              ) : (
                <ul className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => select(h.id)}
                        aria-current={h.id === selectedId}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left transition-colors",
                          h.id === selectedId ? "bg-muted" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="line-clamp-2 text-sm">{h.title ?? h.topic}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {h.status === "running" && <CircleNotch className="size-3 animate-spin text-brand" />}
                          {h.status === "failed" && <span className="text-destructive">Failed</span>}
                          {h.score && <span className={cn("rounded px-1.5 font-mono tabular-nums", SCORE_STYLE[h.score.label])}>{h.score.value}</span>}
                          <span>{DEPTHS[h.depth].label}</span>
                          <span>{ago(h.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
