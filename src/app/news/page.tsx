import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RefreshNewsButton } from "@/components/news-queue";
import { PageHeader } from "@/components/page-header";
import { timeAgo } from "@/lib/format";
import { recentStories, type StoryRow } from "@/lib/news/store";

export const metadata: Metadata = { title: "News queue" };

type Status = "queued" | "used" | "skipped";

const STATUS: Record<Status, { label: string; className: string; hint: string }> = {
  queued: { label: "Queued", className: "border-border-strong text-foreground", hint: "Can be picked for the next Short" },
  used: { label: "Made", className: "border-transparent bg-brand-soft text-brand", hint: "A Short was made from this story" },
  skipped: { label: "Skipped", className: "border-border text-subtle", hint: "Article could not be read (paywall or bot block)" },
};

function statusOf(story: StoryRow): Status {
  if (story.used_at) return "used";
  if (story.skipped_at) return "skipped";
  return "queued";
}

export default function NewsPage() {
  return (
    <>
      <PageHeader
        title="News queue"
        description="AI stories from Hacker News, TechCrunch, The Verge, MIT Technology Review, OpenAI, Google AI and Hugging Face, last 48 hours."
        actions={<RefreshNewsButton />}
      />
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        <Queue />
      </Suspense>
    </>
  );
}

async function Queue() {
  await connection();
  const stories = recentStories();
  if (stories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong px-6 py-12 text-sm text-muted-foreground">
        No stories in the last 48 hours yet. Refresh the news to fetch them.
      </div>
    );
  }

  const counts = { queued: 0, used: 0, skipped: 0 } as Record<Status, number>;
  for (const s of stories) counts[statusOf(s)]++;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-mono tabular-nums text-foreground">{counts.queued}</span> queued,{" "}
        <span className="font-mono tabular-nums text-foreground">{counts.used}</span> made into Shorts,{" "}
        <span className="font-mono tabular-nums text-foreground">{counts.skipped}</span> skipped
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {stories.map((story) => {
          const status = STATUS[statusOf(story)];
          return (
            <li key={story.id}>
              <a
                href={story.url}
                target="_blank"
                rel="noreferrer"
                className="group grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/60 sm:grid-cols-[1fr_9rem_6rem_auto]"
              >
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm text-foreground">{story.title}</span>
                  <span className="mt-0.5 block text-xs text-subtle sm:hidden">
                    {story.source} / {timeAgo(story.published_at)}
                  </span>
                </span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{story.source}</span>
                <span className="hidden text-xs text-subtle sm:block">{timeAgo(story.published_at)}</span>
                <span className="flex items-center gap-3">
                  <span title={status.hint} className={`rounded-full border px-2 py-0.5 text-xs ${status.className}`}>
                    {status.label}
                  </span>
                  <ArrowSquareOut size={14} className="hidden text-subtle opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
