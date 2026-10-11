import { ArrowClockwise, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { ActionButton } from "@/components/action-button";
import { timeAgo } from "@/lib/format";
import type { StoryRow } from "@/lib/news/store";

export function RefreshNewsButton() {
  return (
    <ActionButton endpoint="/api/news" method="GET" pendingLabel="Fetching" icon={<ArrowClockwise size={16} />}>
      Refresh news
    </ActionButton>
  );
}

export function StoryList({ stories, empty }: { stories: StoryRow[]; empty: string }) {
  if (stories.length === 0) return <p className="px-4 py-8 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {stories.map((story) => (
        <li key={story.id}>
          <a
            href={story.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/60"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="line-clamp-2 text-sm leading-snug text-foreground">{story.title}</span>
              <span className="text-xs text-subtle">
                {story.source} <span>/</span> {timeAgo(story.published_at)}
              </span>
            </span>
            <ArrowSquareOut size={14} className="mt-1 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        </li>
      ))}
    </ul>
  );
}
