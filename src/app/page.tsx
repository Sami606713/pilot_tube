import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { RecentVideos } from "@/components/dashboard/recent-videos";
import { StatCard, StatCardSkeleton } from "@/components/dashboard/stat-card";
import { StoryList } from "@/components/news-queue";
import { PageHeader } from "@/components/page-header";
import { NewShortButton } from "@/components/shorts-list";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { unusedStories } from "@/lib/news/store";
import { getOverview, listShorts } from "@/lib/shorts";
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
        description="Your channel and your Shorts pipeline in one place."
        actions={
          <>
            <RefreshYouTubeButton />
            <NewShortButton />
          </>
        }
      />
      <div className="flex flex-col gap-6">
        {/* YouTube numbers come from Composio (cached 15 min) and stream in separately from local data. */}
        <Suspense fallback={<ChannelSkeleton />}>
          <ChannelSection />
        </Suspense>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-6 xl:col-span-8">
            <Suspense fallback={<div className="skeleton h-56 rounded-xl" />}>
              <PipelineSection />
            </Suspense>
          </div>
          <div className="flex flex-col gap-6 xl:col-span-4">
            <Suspense fallback={<div className="skeleton h-80 rounded-xl" />}>
              <ChannelSideSection />
            </Suspense>
            <Suspense fallback={<div className="skeleton h-80 rounded-xl" />}>
              <NewsSection />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}

async function ChannelSection() {
  await connection();
  const rendered = getOverview(listShorts()).rendered;
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
          note={`${rendered} rendered in PilotTube`}
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
    <>
      <TrafficCard traffic={yt.traffic} days={DAYS} />
      <TopVideosCard videos={videos} />
    </>
  );
}

async function PipelineSection() {
  await connection();
  const shorts = listShorts();
  const overview = getOverview(shorts);
  const inScripts = shorts.filter(
    (s) =>
      ["voice", "clips", "cards"].includes(s.next) &&
      !s.done.includes("render"),
  ).length;
  const readyToPublish = shorts.filter(
    (s) => s.done.includes("render") && !s.done.includes("upload"),
  ).length;
  return (
    <>
      <PipelineCard
        stages={[
          { label: "Ideas", count: overview.queuedStories, href: "/research" },
          { label: "Scripts", count: inScripts, href: "/shorts" },
          { label: "Rendering", count: overview.ready, href: "/shorts" },
          { label: "Ready to publish", count: readyToPublish, href: "/studio" },
        ]}
      />
      <RecentVideos shorts={shorts.slice(0, 6)} />
    </>
  );
}

async function NewsSection() {
  await connection();
  const overview = getOverview(listShorts());
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Up next from the news</CardTitle>
        <CardAction>
          <Link
            href="/research"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Research
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <StoryList
          stories={unusedStories(48, 5)}
          empty="No unused AI stories. Open Research to find one."
        />
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {overview.lastNewsAt
          ? `Fetched ${timeAgo(overview.lastNewsAt)}`
          : "Never fetched"}
      </CardFooter>
    </Card>
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
