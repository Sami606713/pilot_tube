"use client";

import { CheckCircle, Circle, CircleNotch, MinusCircle, XCircle } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type StepState = "waiting" | "running" | "done" | "skipped" | "failed";
export type RunStep = { key: string; label: string; state: StepState; detail?: string };

const STEP_ICON: Record<StepState, ReactNode> = {
  waiting: <Circle className="size-4 text-subtle" />,
  running: <CircleNotch weight="bold" className="size-4 animate-spin text-brand" />,
  done: <CheckCircle weight="fill" className="size-4 text-success" />,
  skipped: <MinusCircle className="size-4 text-subtle" />,
  failed: <XCircle weight="fill" className="size-4 text-destructive" />,
};

/** Live progress of a background run (research, script). */
export function RunSteps({ steps, skippedNote = "skipped" }: { steps: RunStep[]; skippedNote?: string }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s) => (
        <li key={s.key} className="flex gap-3">
          <span className="mt-0.5 shrink-0">{STEP_ICON[s.state]}</span>
          <div className="flex min-w-0 flex-col">
            <span className={cn("text-sm", s.state === "waiting" || s.state === "skipped" ? "text-muted-foreground" : "")}>
              {s.label}
              {s.state === "skipped" && ` (${skippedNote})`}
            </span>
            {s.detail && <span className="text-xs text-muted-foreground">{s.detail}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** m:ss since an ISO time, ticking every second. */
export function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - Date.parse(since)) / 1000));
  return <span className="font-mono tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}

export function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
