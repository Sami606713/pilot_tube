import { Article, CaretRight, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { NewScript } from "@/components/scripts/new-script";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";
import { listScripts } from "@/lib/scripts/store";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Scripts" };

export default function ScriptsPage() {
  return (
    <>
      <PageHeader
        title="Scripts"
        description="Dramatic 50-58 second Shorts scripts with a visual, on-screen text, transition and sound cue for every line. Every claim comes from research."
        actions={<NewScript />}
      />
      <Suspense fallback={<div className="skeleton h-80 rounded-xl" aria-busy="true" />}>
        <ScriptList />
      </Suspense>
    </>
  );
}

const scoreTone = (n: number) => (n >= 8 ? "bg-success/15 text-success" : n >= 6.5 ? "bg-amber-400/15 text-amber-400" : "bg-destructive/15 text-destructive");

async function ScriptList() {
  await connection();
  const scripts = listScripts();
  if (scripts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
            <Article className="size-5" />
          </span>
          <p className="font-medium">No scripts yet</p>
          <p className="max-w-[60ch] text-sm text-muted-foreground">Press New script to write one from a finished research, or give a custom topic and PilotTube researches it first.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="py-0">
      <ul className="divide-y divide-border">
        {scripts.map((s) => (
          <li key={s.id}>
            <Link href={`/shorts/${s.id}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-6">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">{s.title ?? s.topic}</span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {s.title && <span className="truncate">{s.topic}</span>}
                  <span>{timeAgo(s.createdAt)}</span>
                </span>
              </div>
              {s.status === "running" && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleNotch className="size-3.5 animate-spin text-brand" /> Writing
                </span>
              )}
              {s.status === "failed" && <span className="text-xs text-destructive">Failed</span>}
              {s.seconds !== null && <span className="hidden font-mono text-sm text-muted-foreground tabular-nums sm:block">{Math.round(s.seconds)}s</span>}
              {s.overall !== null && <span className={cn("rounded-md px-2 py-0.5 font-mono text-sm tabular-nums", scoreTone(s.overall))}>{s.overall.toFixed(1)}</span>}
              <CaretRight className="size-4 shrink-0 text-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
