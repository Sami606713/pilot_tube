import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { compact, RefreshYouTubeButton, TrafficCard, watchTime, YouTubeUnavailable } from "@/components/youtube/channel-widgets";
import { VideosTable } from "@/components/youtube/videos-table";
import { DailyChart } from "@/components/youtube/views-chart";
import { timeAgo } from "@/lib/format";
import { getYouTubeOverview, getYouTubeVideos, percentChange, RANGE_DAYS, type RangeDays } from "@/lib/youtube/analytics";

export const metadata: Metadata = { title: "Analytics" };

function parseDays(value: string | string[] | undefined): RangeDays {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGE_DAYS as readonly number[]).includes(n) ? (n as RangeDays) : 28;
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <>
      <PageHeader title="Analytics" description="How your channel is doing, from YouTube through Composio." actions={<RefreshYouTubeButton />} />
      {/* The range is in the URL (request-time data), so the page streams in under a skeleton. */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        {searchParams.then((sp) => (
          <AnalyticsContent days={parseDays(sp.days)} />
        ))}
      </Suspense>
    </>
  );
}

/** Range filter: one row above everything it controls. */
function RangeTabs({ days }: { days: RangeDays }) {
  return (
    <nav aria-label="Time range" className="inline-flex w-fit rounded-lg bg-muted p-[3px]">
      {RANGE_DAYS.map((d) => (
        <Link
          key={d}
          href={d === 28 ? "/analytics" : `/analytics?days=${d}`}
          aria-current={d === days ? "page" : undefined}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${d === days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {d} days
        </Link>
      ))}
    </nav>
  );
}

async function AnalyticsContent({ days }: { days: RangeDays }) {
  await connection();
  let data;
  try {
    data = await Promise.all([getYouTubeOverview(days), getYouTubeVideos()]);
  } catch (err) {
    return <YouTubeUnavailable error={(err as Error).message} />;
  }
  const [yt, videos] = data;
  const { current, previous } = yt;
  const period = `${days} days`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeTabs days={days} />
        <p className="text-xs text-muted-foreground">
          {yt.channel.title}
          {yt.channel.handle ? ` (${yt.channel.handle})` : ""}. Updated {timeAgo(yt.fetchedAt)}. YouTube Analytics can lag by a day or two.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Views" value={compact(current.views)} change={percentChange(current.views, previous.views)} period={period} />
        <StatCard label="Watch time" value={watchTime(current.minutesWatched)} change={percentChange(current.minutesWatched, previous.minutesWatched)} period={period} />
        <StatCard
          label="Subscribers"
          value={`${current.subscribersGained - current.subscribersLost >= 0 ? "+" : ""}${current.subscribersGained - current.subscribersLost}`}
          note={`${current.subscribersGained} gained, ${current.subscribersLost} lost, ${yt.channel.subscribers.toLocaleString("en-US")} total`}
        />
        <StatCard label="Engagement" value={`${current.likes} likes`} note={`${current.comments} comments, ${current.shares} shares, ${current.avgViewDuration}s avg view`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Views per day</CardTitle>
            <CardDescription>Last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyChart data={yt.daily} metric="views" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New subscribers per day</CardTitle>
            <CardDescription>Last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyChart data={yt.daily} metric="subscribersGained" kind="bar" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <TrafficCard traffic={yt.traffic} days={days} />
        </div>
        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Your videos</CardTitle>
            <CardDescription>The 50 most recent uploads. Views and likes are all time. Click a column to sort.</CardDescription>
          </CardHeader>
          <CardContent>
            <VideosTable videos={videos} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading analytics">
      <div className="skeleton h-9 w-64 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="skeleton h-80 rounded-xl" />
        <div className="skeleton h-80 rounded-xl" />
      </div>
    </div>
  );
}
