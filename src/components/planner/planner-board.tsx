"use client";

import { ArrowSquareOut, CalendarBlank, CaretLeft, CaretRight, CircleNotch, FilmSlate, Lightning, PencilSimple, Plus, Trash, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Stage = "empty" | "topic" | "writing" | "script" | "video" | "scheduled" | "published" | "failed";
type DayPlan = {
  day: string;
  stage: Stage;
  title: string | null;
  researchId: number | null;
  scriptId: number | null;
  duration: number | null;
  upload: { url: string; state: string; publishAt: string | null } | null;
  urgent: boolean;
  external: boolean;
};
type Choice = { id: number; title: string };

const STAGE: Record<Stage, { icon: string; label: string; tone: string }> = {
  empty: { icon: "", label: "Empty", tone: "text-subtle" },
  topic: { icon: "💡", label: "Topic planned", tone: "text-amber-400" },
  writing: { icon: "✍️", label: "Writing script…", tone: "text-sky-400" },
  failed: { icon: "⚠️", label: "Script failed", tone: "text-destructive" },
  script: { icon: "📝", label: "Script ready", tone: "text-sky-400" },
  video: { icon: "🎬", label: "Video ready", tone: "text-violet-400" },
  scheduled: { icon: "⏰", label: "Scheduled", tone: "text-success" },
  published: { icon: "✅", label: "Published", tone: "text-success" },
};

const TIMES = Array.from({ length: 24 * 2 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function dayLabel(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return { weekday: d.toLocaleDateString("en-GB", { weekday: "short" }), date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) };
}

export function PlannerBoard({
  week,
  prevWeek,
  nextWeek,
  isThisWeek,
  today,
  postTime,
  research,
  scripts,
}: {
  week: DayPlan[];
  prevWeek: string;
  nextWeek: string;
  isThisWeek: boolean;
  today: string;
  postTime: string;
  research: Choice[];
  scripts: Choice[];
}) {
  const router = useRouter();
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [source, setSource] = useState<"topic" | "research" | "script">("topic");
  const [topic, setTopic] = useState("");
  const [pick, setPick] = useState<number | "">("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh while a script is being written.
  const writing = week.some((d) => d.stage === "writing");
  useEffect(() => {
    if (!writing) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [writing, router]);

  async function call(url: string, method: string, body: object | null, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function savePlan() {
    if (!planFor) return;
    const body = source === "topic" ? { day: planFor, topic } : source === "research" ? { day: planFor, researchId: pick } : { day: planFor, scriptId: pick };
    if (await call("/api/planner", "POST", body, "plan")) {
      setPlanFor(null);
      setTopic("");
      setPick("");
    }
  }

  const ready = week.filter((d) => ["video", "scheduled", "published"].includes(d.stage)).length;
  const scheduled = week.filter((d) => d.stage === "scheduled").length;
  const empty = week.filter((d) => d.stage === "empty" && d.day >= today).length;
  const emptyDays = week.filter((d) => d.stage === "empty" && d.day >= today).map((d) => d.day);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          This week: <span className="text-foreground">{ready} of 7 days ready</span> · {scheduled} scheduled · {empty} empty
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Post time
            <select
              value={postTime}
              onChange={(e) => call("/api/planner", "POST", { postTime: e.target.value }, "time")}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
              aria-label="Daily post time"
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" asChild aria-label="Previous week">
              <Link href={`/planner?week=${prevWeek}`}>
                <CaretLeft />
              </Link>
            </Button>
            <Button variant={isThisWeek ? "secondary" : "ghost"} size="sm" asChild>
              <Link href="/planner">This week</Link>
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Next week">
              <Link href={`/planner?week=${nextWeek}`}>
                <CaretRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <Warning className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {week.map((d) => {
          const { weekday, date } = dayLabel(d.day);
          const past = d.day < today;
          const s = STAGE[d.stage];
          return (
            <Card
              key={d.day}
              className={cn(
                "min-h-56 gap-0 py-0",
                d.day === today && "ring-2 ring-brand/60",
                d.urgent && "ring-2 ring-destructive/70",
                past && d.stage === "empty" && "opacity-50",
              )}
            >
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">
                    {weekday} <span className="font-normal text-muted-foreground">{date}</span>
                  </span>
                  {d.day === today && <span className="text-[10px] tracking-wide text-brand uppercase">Today</span>}
                </div>

                {d.stage === "empty" ? (
                  past ? (
                    <p className="text-xs text-subtle">Nothing posted</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (setPlanFor(d.day), setError(null))}
                      className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      <Plus className="size-5" /> Plan
                    </button>
                  )
                ) : (
                  <>
                    <span className={cn("text-xs font-medium", s.tone)}>
                      {s.icon} {s.label}
                      {d.stage === "scheduled" && ` · ${postTime}`}
                    </span>
                    <p className="line-clamp-4 text-sm leading-snug">{d.title}</p>
                    {d.duration !== null && (
                      <span className={cn("font-mono text-xs tabular-nums", d.duration > 60 ? "text-destructive" : "text-muted-foreground")}>
                        {Math.round(d.duration)}s{d.duration > 60 && " · over 60s"}
                      </span>
                    )}
                    {d.urgent && <span className="text-xs text-destructive">Goes out in under 24h and isn&apos;t ready</span>}

                    <div className="mt-auto flex flex-col gap-1.5">
                      {(d.stage === "topic" || d.stage === "failed") && (
                        <Button size="sm" onClick={() => call(`/api/planner/${d.day}/script`, "POST", null, `script-${d.day}`)} disabled={busy !== null}>
                          {busy === `script-${d.day}` ? <CircleNotch className="animate-spin" /> : <PencilSimple />} {d.stage === "failed" ? "Try script again" : "Write script"}
                        </Button>
                      )}
                      {d.stage === "writing" && d.scriptId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/shorts/${d.scriptId}`}>
                            <CircleNotch className="animate-spin" /> Watch progress
                          </Link>
                        </Button>
                      )}
                      {d.stage === "script" && d.scriptId && (
                        <Button size="sm" asChild>
                          <Link href={`/studio?script=${d.scriptId}`}>
                            <FilmSlate /> Make video
                          </Link>
                        </Button>
                      )}
                      {d.stage === "video" && (
                        <Button
                          size="sm"
                          onClick={() => call(`/api/planner/${d.day}/schedule`, "POST", null, `sched-${d.day}`)}
                          disabled={busy !== null || past || (d.duration ?? 0) > 60}
                          title={(d.duration ?? 0) > 60 ? "Over 60 seconds: YouTube won't treat it as a Short" : undefined}
                        >
                          {busy === `sched-${d.day}` ? <CircleNotch className="animate-spin" /> : <CalendarBlank />} Schedule {postTime}
                        </Button>
                      )}
                      {d.upload && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={d.upload.url} target="_blank" rel="noreferrer">
                            <ArrowSquareOut /> On YouTube
                          </a>
                        </Button>
                      )}
                      {!d.external && !d.upload && (
                        <div className="flex items-center gap-1">
                          {emptyDays.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => e.target.value && call(`/api/planner/${d.day}`, "PATCH", { to: e.target.value }, `move-${d.day}`)}
                              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-1 text-xs text-muted-foreground"
                              aria-label="Move to another day"
                            >
                              <option value="">Move to…</option>
                              {emptyDays.map((e) => (
                                <option key={e} value={e}>
                                  {dayLabel(e).weekday} {dayLabel(e).date}
                                </option>
                              ))}
                            </select>
                          )}
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => window.confirm("Remove this plan? The script and video stay.") && call(`/api/planner/${d.day}`, "DELETE", null, `del-${d.day}`)}
                            aria-label="Remove plan"
                          >
                            <Trash />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={planFor !== null} onOpenChange={(o) => !o && setPlanFor(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Plan {planFor && `${dayLabel(planFor).weekday} ${dayLabel(planFor).date}`}</SheetTitle>
            <SheetDescription>Goes out at {postTime}. Pick what this day&apos;s Short is about.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            {(
              [
                ["topic", "Type a topic", "Research and the script run when you press Write script."],
                ["research", "A finished research", `${research.length} available`],
                ["script", "A finished script", `${scripts.length} not planned yet`],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className={cn("flex cursor-pointer flex-col gap-2 rounded-lg border p-3", source === key ? "border-brand bg-brand-soft" : "border-border")}>
                <span className="flex items-center gap-2 text-sm">
                  <input type="radio" name="source" checked={source === key} onChange={() => (setSource(key), setPick(""))} className="accent-[var(--brand)]" />
                  {label}
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </span>
                {source === key && key === "topic" && <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Google Gemini 3 launch" autoFocus />}
                {source === key && key !== "topic" && (
                  <select value={pick} onChange={(e) => setPick(e.target.value ? Number(e.target.value) : "")} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="">Pick…</option>
                    {(key === "research" ? research : scripts).map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.id} {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPlanFor(null)}>
                Cancel
              </Button>
              <Button onClick={savePlan} disabled={busy !== null || (source === "topic" ? topic.trim().length < 3 : pick === "")}>
                {busy === "plan" ? <CircleNotch className="animate-spin" /> : <Lightning weight="fill" />} Plan it
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
