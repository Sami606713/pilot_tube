"use client";

import { ArrowSquareOut, ArrowUp, ChatCircle, Globe } from "@phosphor-icons/react";
import { MakeShortButton } from "@/components/research/make-short-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import type { ResearchStory } from "@/lib/news/research";

export function StoryCard({ story }: { story: ResearchStory }) {
  return (
    <article className="group grid grid-cols-[auto_1fr] gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:border-border-strong sm:p-4">
      <a href={story.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden className="block">
        {story.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote news thumbnail
          <img
            src={story.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-[4/3] w-24 rounded-lg bg-secondary object-cover sm:w-32"
          />
        ) : story.points !== null ? (
          // No picture (Hacker News): show the popularity, which is what makes these stories worth a look.
          <span className="flex aspect-[4/3] w-24 flex-col items-center justify-center rounded-lg bg-brand-soft text-brand sm:w-32">
            <span className="font-mono text-2xl font-semibold tabular-nums">{story.points}</span>
            <span className="text-[11px] tracking-wide uppercase">points</span>
          </span>
        ) : (
          <span className="grid aspect-[4/3] w-24 place-items-center rounded-lg bg-secondary text-lg font-semibold text-muted-foreground sm:w-32">
            {story.source.slice(0, 2).toUpperCase()}
          </span>
        )}
      </a>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{story.source}</span>
          <span className="text-subtle">{timeAgo(story.publishedAt)}</span>
          {story.points !== null && story.image && (
            <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-brand">
              <ArrowUp weight="bold" className="size-3" />
              {story.points}
            </span>
          )}
          {story.comments !== null && (
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <ChatCircle className="size-3" />
              {story.comments}
            </span>
          )}
          {story.live && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal" title="Found by this search on the live web">
              <Globe className="size-3" /> Web
            </Badge>
          )}
          {story.status === "used" && <Badge className="h-5 bg-success/15 px-1.5 text-[10px] text-success">Made</Badge>}
          {story.status === "skipped" && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-subtle" title="Article could not be read">
              Skipped
            </Badge>
          )}
        </div>

        <a href={story.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-[15px] leading-snug font-medium text-balance hover:text-brand">
          {story.title}
        </a>
        {story.summary && <p className="line-clamp-2 max-w-[70ch] text-sm text-muted-foreground">{story.summary}</p>}

        <div className="mt-1 flex flex-wrap items-start gap-2">
          {story.status !== "used" && <MakeShortButton storyId={story.id} />}
          <Button variant="ghost" size="sm" asChild>
            <a href={story.url} target="_blank" rel="noreferrer">
              <ArrowSquareOut /> Open article
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

export function StoryCardSkeleton() {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="skeleton aspect-[4/3] w-24 rounded-lg sm:w-32" />
      <div className="flex flex-col gap-2.5">
        <div className="skeleton h-3 w-40 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton mt-1 h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
}
