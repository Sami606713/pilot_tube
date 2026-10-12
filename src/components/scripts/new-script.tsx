"use client";

import { CircleNotch, Lightning, MagnifyingGlass, Warning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ago } from "@/components/run-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEPTHS, TIME_RANGES, type Depth, type ResearchSummary, type TimeRange } from "@/lib/research/types";
import { cn } from "@/lib/utils";

const SCORE = { Strong: "bg-success/15 text-success", OK: "bg-amber-400/15 text-amber-400", Weak: "bg-destructive/15 text-destructive" } as const;

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
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
            className={cn("rounded-md px-3 py-1 text-sm", value === k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** New script: from a finished research, or a custom topic (research runs first). */
export function NewScript() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [research, setResearch] = useState<ResearchSummary[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [depth, setDepth] = useState<Depth>("quick");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openSheet(next: boolean) {
    setOpen(next);
    if (!next) return;
    const res = await fetch("/api/research");
    const list = ((await res.json()).research as ResearchSummary[]).filter((r) => r.status === "done");
    setResearch(list);
    setPicked((p) => p ?? list[0]?.id ?? null);
  }

  async function start(body: object) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setOpen(false);
      router.push(`/shorts/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  const pickedItem = research?.find((r) => r.id === picked);

  return (
    <Sheet open={open} onOpenChange={openSheet}>
      <SheetTrigger asChild>
        <Button>
          <Lightning weight="fill" /> New script
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New script</SheetTitle>
          <SheetDescription>A dramatic 50-58 second Short script with edit cues, written only from researched facts.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <Tabs defaultValue="research" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="research">From research</TabsTrigger>
              <TabsTrigger value="custom">Custom topic</TabsTrigger>
            </TabsList>

            <TabsContent value="research" className="flex flex-col gap-4">
              {research === null ? (
                <div className="skeleton h-48 rounded-xl" aria-busy="true" />
              ) : research.length === 0 ? (
                <p className="text-sm text-muted-foreground">No finished research yet. Use Custom topic, or run one on the Research page.</p>
              ) : (
                <ul role="radiogroup" aria-label="Research" className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
                  {research.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={picked === r.id}
                        onClick={() => setPicked(r.id)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          picked === r.id ? "border-foreground/30 bg-muted" : "border-transparent hover:bg-muted/60",
                        )}
                      >
                        {r.score && <span className={cn("mt-0.5 rounded px-1.5 font-mono text-xs tabular-nums", SCORE[r.score.label])}>{r.score.value}</span>}
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="line-clamp-2 text-sm">{r.title ?? r.topic}</span>
                          <span className="text-xs text-muted-foreground">
                            {DEPTHS[r.depth].label} · {ago(r.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pickedItem?.score?.label === "Weak" && (
                <p className="flex items-start gap-1.5 text-xs text-amber-400">
                  <Warning className="mt-px size-3.5 shrink-0" /> Weak evidence: the script will have fewer facts to work with.
                </p>
              )}
              <Button onClick={() => picked !== null && start({ researchId: picked })} disabled={picked === null || pending} className="w-fit">
                {pending ? <CircleNotch className="animate-spin" /> : <Lightning weight="fill" />} Write script
              </Button>
            </TabsContent>

            <TabsContent value="custom">
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (topic.trim().length >= 3) start({ topic, timeRange, depth });
                }}
              >
                <div className="relative">
                  <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A topic or an article link" aria-label="Topic" className="h-10 pl-9" maxLength={300} />
                </div>
                <Choice label="Time range" value={timeRange} options={TIME_RANGES} onChange={setTimeRange} />
                <Choice label="Research depth" value={depth} options={{ quick: DEPTHS.quick.label, deep: DEPTHS.deep.label }} onChange={setDepth} />
                <p className="text-xs text-muted-foreground">Research runs first ({DEPTHS[depth].hint.toLowerCase()}), then the script is written. It is saved in Research too.</p>
                <Button type="submit" disabled={topic.trim().length < 3 || pending} className="w-fit">
                  {pending ? <CircleNotch className="animate-spin" /> : <Lightning weight="fill" />} Research and write
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          {error && (
            <p role="alert" className="mt-4 flex items-center gap-1.5 text-sm text-destructive">
              <Warning className="size-4" /> {error}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
