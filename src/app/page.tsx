import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  compact,
  RefreshYouTubeButton,
  TopVideosCard,
  TrafficCard,
  watchTime,
  YouTubeUnavailable,
} from "@/components/youtube/channel-widgets";
import { DailyChart } from "@/components/youtube/views-chart";
import { timeAgo } from "@/lib/format";
import {
  getYouTubeOverview,
  getYouTubeVideos,
  percentChange,
} from "@/lib/youtube/analytics";

const DAYS = 28;

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="How your channel is doing, from YouTube through Composio."
        actions={<RefreshYouTubeButton />}
      />
      <div className="flex flex-col gap-6">
        {/* YouTube numbers come from Composio (cached 15 min) and stream in separately from local data. */}
        <Suspense fallback={<ChannelSkeleton />}>
          <ChannelSection />
        </Suspense>

        <Suspense fallback={<div className="skeleton h-80 rounded-xl" />}>
          <ChannelSideSection />
        </Suspense>
      </div>
    </>
  );
}

async function ChannelSection() {
  await connection();
  let yt;
  try {
    yt = await getYouTubeOverview(DAYS);
  } catch (err) {
    return <YouTubeUnavailable error={(err as Error).message} />;
  }
  const { current, previous, channel } = yt;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Subscribers"
          value={channel.subscribers.toLocaleString("en-US")}
          note={`+${current.subscribersGained} gained, ${current.subscribersLost} lost in ${DAYS} days`}
        />
        <StatCard
          label={`Views, last ${DAYS} days`}
          value={compact(current.views)}
          change={percentChange(current.views, previous.views)}
        />
        <StatCard
          label={`Watch time, last ${DAYS} days`}
          value={watchTime(current.minutesWatched)}
          note={`About ${current.avgViewDuration}s per view`}
        />
        <StatCard
          label="Videos on YouTube"
          value={channel.videos.toLocaleString("en-US")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Views per day</CardTitle>
          <CardDescription>
            {channel.title}
            {channel.handle ? ` (${channel.handle})` : ""}, last {DAYS} days.
            Updated {timeAgo(yt.fetchedAt)}.
          </CardDescription>
          <CardAction>
            <Link
              href="/analytics"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Analytics
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DailyChart data={yt.daily} metric="views" />
        </CardContent>
      </Card>
    </div>
  );
}

async function ChannelSideSection() {
  await connection();
  let data;
  try {
    data = await Promise.all([getYouTubeOverview(DAYS), getYouTubeVideos()]);
  } catch {
    // ChannelSection already explains the problem; don't repeat it here.
    return null;
  }
  const [yt, videos] = data;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TrafficCard traffic={yt.traffic} days={DAYS} />
      <TopVideosCard videos={videos} />
    </div>
  );
}

function ChannelSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading channel numbers"
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="skeleton h-[330px] rounded-xl" />
    </div>
  );
}
