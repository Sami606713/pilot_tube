"use client";

import { CircleNotch, Fire, MagnifyingGlass, WarningCircle, X } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StoryCard, StoryCardSkeleton } from "@/components/research/story-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ResearchResult } from "@/lib/news/research";

const QUICK_TOPICS = ["AI agents", "OpenAI", "Claude", "Gemini", "LLMs", "Nvidia", "Open source AI", "AI startups", "Robotics"];
const RANGE_LABEL = { today: "today", week: "this week", month: "this month" } as const;
const SEARCH_DELAY_MS = 350;

type Filters = { q: string; range: keyof typeof RANGE_LABEL; source: string; sort: string; status: string };

function readFilters(params: URLSearchParams): Filters {
  const range = params.get("range");
  return {
    q: params.get("q") ?? "",
    range: range === "today" || range === "month" ? range : "week",
    source: params.get("source") ?? "all",
    sort: params.get("sort") === "popular" ? "popular" : "newest",
    status: params.get("status") ?? "all",
  };
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.range !== "week") p.set("range", f.range);
  if (f.source !== "all") p.set("source", f.source);
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.status !== "all") p.set("status", f.status);
  return p.toString();
}

export function ResearchExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = readFilters(searchParams);

  const [filters, setFilters] = useState<Filters>(initial);
  const [typed, setTyped] = useState(initial.q);
  // Each response remembers which query it answers; we're loading until the latest one arrives.
  const [response, setResponse] = useState<{ query: string; result: ResearchResult | null; error: string | null } | null>(null);
  const query = toQuery(filters);
  const loading = response?.query !== query;
  const result = response?.result ?? null;
  const error = response?.query === query ? response.error : null;

  // Debounce typing into the q filter, so search runs as you type without a request per key.
  useEffect(() => {
    if (typed === filters.q) return;
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: typed, source: "all" })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed, filters.q]);

  // Fetch whenever the query changes; aborting the previous request keeps stale results from landing.
  useEffect(() => {
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    const controller = new AbortController();
    fetch(`/api/research?${query}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        setResponse({ query, result: body as ResearchResult, error: null });
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setResponse((prev) => ({ query, result: prev?.result ?? null, error: err.message }));
      });
    return () => controller.abort();
  }, [query, pathname, router]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const searchTopic = (topic: string) => {
    setTyped(topic);
    set({ q: topic, source: "all" });
  };

  const stories = result?.stories ?? [];
  const searching = filters.q.trim().length >= 2;

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Search AI topics, e.g. AI agents, Gemini, Nvidia chips"
            aria-label="Search AI news"
            className="h-12 rounded-xl pr-24 pl-12 text-base md:text-base"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            {loading && <CircleNotch className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />}
            {typed && (
              <button type="button" onClick={() => searchTopic("")} aria-label="Clear search" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => searchTopic(topic)}
              aria-pressed={filters.q === topic}
              className={`h-8 rounded-full border px-3 text-sm transition-colors ${
                filters.q === topic ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filters.range} onValueChange={(v) => set({ range: v as Filters["range"] })}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="month">This month</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={filters.source} onValueChange={(v) => set({ source: v })}>
            <SelectTrigger className="w-44" aria-label="Source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {(result?.sources ?? []).map((s) => (
                <SelectItem key={s.source} value={s.source}>
                  {s.source} ({s.count})
                </SelectItem>
              ))}
              {filters.source !== "all" && !result?.sources.some((s) => s.source === filters.source) && (
                <SelectItem value={filters.source}>{filters.source}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
            <SelectTrigger className="w-36" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="new">Not made yet</SelectItem>
              <SelectItem value="used">Made</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => set({ sort: v })}>
            <SelectTrigger className="w-36" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Most popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Results */}
        <section className="flex flex-col gap-3 xl:col-span-8" aria-live="polite" aria-busy={loading}>
          <p className="text-sm text-muted-foreground">
            {result ? (
              <>
                <span className="font-mono text-foreground tabular-nums">{stories.length}</span> stories {RANGE_LABEL[filters.range]}
                {searching && (
                  <>
                    {" "}
                    for <span className="text-foreground">&ldquo;{filters.q.trim()}&rdquo;</span>, including a live web search
                  </>
                )}
              </>
            ) : (
              "Loading stories"
            )}
          </p>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <WarningCircle weight="bold" className="size-4" /> {error}
            </p>
          )}
          {result && result.liveErrors.length > 0 && (
            <p className="text-xs text-subtle">Some live sources did not answer: {result.liveErrors.join("; ")}</p>
          )}

          {!result && loading ? (
            Array.from({ length: 5 }, (_, i) => <StoryCardSkeleton key={i} />)
          ) : stories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-2 py-4">
                <p className="font-medium">Nothing found {RANGE_LABEL[filters.range]}</p>
                <p className="text-sm text-muted-foreground">
                  Try a wider time range{filters.source !== "all" || filters.status !== "all" ? " or clear the filters" : ""}, or a broader topic.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </section>

        {/* Trending */}
        <aside className="xl:col-span-4">
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Fire weight="fill" className="size-5 text-primary" /> Trending {RANGE_LABEL[filters.range]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result && result.trending.length > 0 ? (
                <ol className="flex flex-col gap-1">
                  {result.trending.map((t, i) => {
                    const max = result.trending[0].count;
                    return (
                      <li key={t.topic}>
                        <button
                          type="button"
                          onClick={() => searchTopic(t.topic)}
                          className="grid w-full grid-cols-[1.25rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary"
                        >
                          <span className="font-mono text-xs text-subtle tabular-nums">{i + 1}</span>
                          <span className="flex min-w-0 flex-col gap-1.5">
                            <span className="truncate">{t.topic}</span>
                            <span className="h-1 overflow-hidden rounded-full bg-secondary">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max((t.count / max) * 100, 6)}%` }} />
                            </span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">{t.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{loading ? "Counting topics" : "Not enough stories to spot a trend yet."}</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
