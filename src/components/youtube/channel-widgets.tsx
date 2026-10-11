import { ArrowSquareOut, Eye, Heart, PlugsConnected, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";
import type { TrafficSource, VideoStat } from "@/lib/youtube/analytics";

export const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Watch time: "41 min" or "3.2 h". */
export function watchTime(minutes: number): string {
  return minutes < 120 ? `${Math.round(minutes)} min` : `${(minutes / 60).toFixed(1)} h`;
}

export function RefreshYouTubeButton() {
  return (
    <ActionButton endpoint="/api/youtube/refresh" pendingLabel="Refreshing" icon={<YoutubeLogo className="size-4" />}>
      Refresh YouTube
    </ActionButton>
  );
}

/** Shown when Composio or YouTube can't be reached, instead of breaking the page. */
export function YouTubeUnavailable({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
          <PlugsConnected className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">YouTube numbers are unavailable</p>
          <p className="max-w-[60ch] text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings">Check connections</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Where views come from, as share bars (one hue: magnitude, not identity). */
export function TrafficCard({ traffic, days }: { traffic: TrafficSource[]; days: number }) {
  const total = traffic.reduce((sum, t) => sum + t.views, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where viewers come from</CardTitle>
        <CardDescription>Last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No views in this period yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {traffic.slice(0, 6).map((t) => {
              const share = (t.views / total) * 100;
              return (
                <li key={t.source} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{t.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      <span className="text-foreground">{Math.round(share)}%</span> / {t.views}
                    </span>
                  </div>
                  <span className="h-1.5 overflow-hidden rounded-full bg-secondary" role="presentation">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(share, 2)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Best recent uploads by views. */
export function TopVideosCard({ videos, limit = 5 }: { videos: VideoStat[]; limit?: number }) {
  const top = [...videos].filter((v) => v.privacy === "public").sort((a, b) => b.views - a.views).slice(0, limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top videos</CardTitle>
        <CardDescription>Most viewed of your recent uploads</CardDescription>
        <CardAction>
          <Link href="/analytics" className="text-sm text-muted-foreground hover:text-foreground">
            All videos
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-3">
        {top.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">No public videos yet.</p>
        ) : (
          <ol className="flex flex-col">
            {top.map((v) => (
              <li key={v.id}>
                <a href={v.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/60">
                  {v.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
                    <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-20 shrink-0 rounded-md object-cover ring-1 ring-border" />
                  ) : (
                    <span className="aspect-video w-20 shrink-0 rounded-md bg-secondary" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-2 text-sm leading-snug font-medium group-hover:text-brand">{v.title}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" /> {compact(v.views)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="size-3.5" /> {compact(v.likes)}
                      </span>
                      <span>{timeAgo(v.publishedAt)}</span>
                    </span>
                  </span>
                  <ArrowSquareOut className="size-4 shrink-0 text-subtle opacity-0 group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
