"use client";

import { ArrowSquareOut, CheckCircle, Question, Warning, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FactStatus, ResearchResult, Source, SourceKind } from "@/lib/research/types";
import { cn } from "@/lib/utils";

/** "text [1, 3]" → text with small citation links that open the source. */
function Cited({ text, sources }: { text: string; sources: Source[] }) {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
        if (!m) return <span key={i}>{part}</span>;
        const list = m[1].split(",").map(Number);
        // Long runs of citations wrap badly: show 3, the rest as "+N" (titles on hover).
        const rest = list.slice(3).map((n) => sources.find((x) => x.n === n)).filter(Boolean);
        return (
          <span key={i} className="whitespace-nowrap">
            {list.slice(0, 3).map((n) => <Cite key={n} n={n} sources={sources} />)}
            {rest.length > 0 && (
              <span
                title={rest.map((x) => `[${x!.n}] ${x!.domain}`).join("\n")}
                className="ml-0.5 inline-grid h-4 place-items-center rounded bg-muted px-1 align-super font-mono text-[10px] leading-none text-muted-foreground"
              >
                +{rest.length}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

function Cite({ n, sources }: { n: number; sources: Source[] }) {
  const s = sources.find((x) => x.n === n);
  if (!s) return null;
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noreferrer"
      title={`${s.title} (${s.domain})`}
      className="ml-0.5 inline-grid h-4 min-w-4 place-items-center rounded bg-muted px-1 align-super font-mono text-[10px] leading-none text-muted-foreground no-underline hover:bg-brand-soft hover:text-brand"
    >
      {n}
    </a>
  );
}

/** Append [n] citations unless the text already carries its own. */
const withRefs = (text: string, list: number[]) => (/\[\d/.test(text) || !list.length ? text : `${text} [${list.join(", ")}]`);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

const KIND: Record<SourceKind, { label: string; className: string }> = {
  official: { label: "Official", className: "bg-success/15 text-success" },
  news: { label: "News", className: "bg-sky-500/15 text-sky-400" },
  other: { label: "Other", className: "bg-muted text-muted-foreground" },
};

export const STATUS: Record<FactStatus, { label: string; icon: ReactNode; className: string }> = {
  confirmed: { label: "Confirmed", icon: <CheckCircle weight="fill" className="size-4" />, className: "text-success" },
  single: { label: "Single source", icon: <WarningCircle weight="fill" className="size-4" />, className: "text-amber-400" },
  conflict: { label: "Conflict", icon: <XCircle weight="fill" className="size-4" />, className: "text-destructive" },
};

export function ReportView({ result }: { result: ResearchResult }) {
  const { report: p, sources, facts } = result;
  const [filter, setFilter] = useState<FactStatus | "all">("all");
  const shown = filter === "all" ? facts : facts.filter((f) => f.status === filter);
  const prose = "text-sm leading-relaxed text-foreground/90";

  return (
    <Tabs defaultValue="report" className="gap-5">
      <TabsList>
        <TabsTrigger value="report">Report</TabsTrigger>
        <TabsTrigger value="facts">Facts ({facts.length})</TabsTrigger>
        <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
        <TabsTrigger value="timeline">Timeline ({p.timeline.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="report" className="flex flex-col gap-7">
        <p className="max-w-[75ch] text-[15px] leading-relaxed">
          <Cited text={p.summary} sources={sources} />
        </p>

        {p.keyNumbers.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {p.keyNumbers.map((k, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
                <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{k.value}</span>
                <span className="text-xs leading-snug text-muted-foreground">
                  <Cited text={withRefs(k.label, k.sources)} sources={sources} />
                </span>
              </div>
            ))}
          </div>
        )}

        {p.keyPoints.length > 0 && (
          <Section title="Key points">
            <ul className="flex max-w-[75ch] list-disc flex-col gap-2 pl-5 marker:text-subtle">
              {p.keyPoints.map((k, i) => (
                <li key={i} className={prose}>
                  <Cited text={k} sources={sources} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="grid max-w-[75ch] gap-7">
          {p.whyItMatters && (
            <Section title="Why it matters">
              <p className={prose}><Cited text={p.whyItMatters} sources={sources} /></p>
            </Section>
          )}
          {p.background && (
            <Section title="Background">
              <p className={prose}><Cited text={p.background} sources={sources} /></p>
            </Section>
          )}
          {p.viewpoints.length > 0 && (
            <Section title="Viewpoints">
              <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-subtle">
                {p.viewpoints.map((v, i) => (
                  <li key={i} className={prose}><Cited text={v} sources={sources} /></li>
                ))}
              </ul>
            </Section>
          )}
          {p.whatsNext && (
            <Section title="What's next">
              <p className={prose}><Cited text={p.whatsNext} sources={sources} /></p>
            </Section>
          )}
          {p.openQuestions.length > 0 && (
            <Section title="Open questions">
              <ul className="flex flex-col gap-2">
                {p.openQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90">
                    <Question className="mt-0.5 size-4 shrink-0 text-amber-400" />
                    <span><Cited text={q} sources={sources} /></span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Questions researched">
            <ul className="flex flex-col gap-1.5">
              {result.questions.map((q, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  {q.answered ? <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-subtle" />}
                  <span className={q.answered ? "" : "text-muted-foreground"}>{q.question}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </TabsContent>

      <TabsContent value="facts" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter facts">
          {(["all", "confirmed", "single", "conflict"] as const).map((f) => {
            const n = f === "all" ? facts.length : facts.filter((x) => x.status === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === f ? "border-foreground/30 bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? "All" : STATUS[f].label} ({n})
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Every quote below was checked to appear word for word on its source page. Confirmed = an official source or 2+ different sites agree.
        </p>
        <div className="flex flex-col gap-3">
          {shown.map((f) => (
            <Card key={f.id} className="py-4">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className={cn("mt-0.5 shrink-0", STATUS[f.status].className)} title={STATUS[f.status].label}>
                    {STATUS[f.status].icon}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-medium">
                      <Cited text={withRefs(f.statement, f.sources)} sources={sources} />
                    </p>
                    {f.note && (
                      <p className="flex items-start gap-1.5 text-xs text-destructive">
                        <Warning className="mt-px size-3.5 shrink-0" /> {f.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 pl-6">
                  {f.quotes.map((q, i) => {
                    const s = sources.find((x) => x.n === q.source);
                    return (
                      <blockquote key={i} className="border-l-2 border-border pl-3 text-xs leading-relaxed text-muted-foreground">
                        &ldquo;{q.quote}&rdquo;
                        {s && (
                          <a href={s.url} target="_blank" rel="noreferrer" className="ml-1.5 whitespace-nowrap text-subtle hover:text-foreground">
                            [{s.n}] {s.domain}
                          </a>
                        )}
                      </blockquote>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="sources">
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {sources.map((s) => (
            <li key={s.n} className="flex gap-3 p-4">
              <span className="w-6 shrink-0 font-mono text-xs text-subtle tabular-nums">[{s.n}]</span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <a href={s.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1.5 text-sm font-medium hover:text-brand">
                  <span className="line-clamp-2">{s.title}</span>
                  <ArrowSquareOut className="mt-0.5 size-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
                </a>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <Badge className={cn("h-5 border-0 text-[10px]", KIND[s.kind].className)}>{KIND[s.kind].label}</Badge>
                  <span>{s.domain}</span>
                  <span className="font-mono tabular-nums">{s.published ?? "no date"}</span>
                  <span>{s.read ? "Read in full" : "Snippet only"}</span>
                  {s.round === 2 && <span>Round 2</span>}
                </div>
                {s.snippet && <p className="line-clamp-2 text-xs leading-relaxed text-subtle">{s.snippet}</p>}
              </div>
            </li>
          ))}
        </ol>
      </TabsContent>

      <TabsContent value="timeline">
        {p.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">The sources gave no clear dates.</p>
        ) : (
          <ol className="relative flex flex-col gap-5 border-l border-border pl-5">
            {p.timeline.map((t, i) => (
              <li key={i} className="relative flex flex-col gap-1">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand ring-4 ring-background" />
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{t.date}</span>
                <p className="text-sm"><Cited text={withRefs(t.event, t.sources)} sources={sources} /></p>
              </li>
            ))}
          </ol>
        )}
      </TabsContent>
    </Tabs>
  );
}
