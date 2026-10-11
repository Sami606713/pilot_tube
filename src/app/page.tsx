import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { RecentVideos } from "@/components/dashboard/recent-videos";
import { StatCard } from "@/components/dashboard/stat-card";
import { RefreshNewsButton, StoryList } from "@/components/news-queue";
import { PageHeader } from "@/components/page-header";
import { NewShortButton } from "@/components/shorts-list";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";
import { unusedStories } from "@/lib/news/store";
import { getOverview, listShorts } from "@/lib/shorts";

// Placeholder channel numbers until YouTube is connected through Composio. Shown with a "Sample" tag.
const SAMPLE_CHANNEL = { views: "128.4K", viewsTrend: "+12.8%", subscribers: "4,820", subscribersTrend: "+8.2%" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Manage your content from one place." actions={<NewShortButton />} />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  await connection();
  const shorts = listShorts();
  const overview = getOverview(shorts);
  const stories = unusedStories(48, 5);

  const inScripts = shorts.filter((s) => ["voice", "clips", "cards"].includes(s.next) && !s.done.includes("render")).length;
  const readyToPublish = shorts.filter((s) => s.done.includes("render") && !s.done.includes("upload")).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total views" value={SAMPLE_CHANNEL.views} trend={SAMPLE_CHANNEL.viewsTrend} sample />
        <StatCard label="Subscribers" value={SAMPLE_CHANNEL.subscribers} trend={SAMPLE_CHANNEL.subscribersTrend} sample />
        <StatCard label="Videos rendered" value={String(overview.rendered)} note={`${overview.total} Shorts made in total`} />
        <StatCard label="In production" value={String(overview.total - overview.rendered)} note="Across all stages" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <PipelineCard
            stages={[
              { label: "Ideas", count: overview.queuedStories, href: "/news" },
              { label: "Scripts", count: inScripts, href: "/shorts" },
              { label: "Rendering", count: overview.ready, href: "/shorts" },
              { label: "Ready to publish", count: readyToPublish, href: "/studio" },
            ]}
          />
          <RecentVideos shorts={shorts.slice(0, 6)} />
        </div>

        <Card className="xl:col-span-4 xl:self-start">
          <CardHeader>
            <CardTitle className="text-base">Up next from the news</CardTitle>
            <CardAction>
              <RefreshNewsButton />
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <StoryList stories={stories} empty="No unused stories. Refresh to pull the latest AI news." />
          </CardContent>
          <CardFooter className="justify-between text-xs text-muted-foreground">
            <span>{overview.lastNewsAt ? `Fetched ${timeAgo(overview.lastNewsAt)}` : "Never fetched"}</span>
            <Link href="/news" className="hover:text-foreground">
              Full queue
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-[118px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <div className="skeleton h-56 rounded-xl" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
        <div className="skeleton h-96 rounded-xl xl:col-span-4" />
      </div>
    </div>
  );
}
