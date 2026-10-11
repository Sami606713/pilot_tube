import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RefreshNewsButton, StoryList } from "@/components/news-queue";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { NewShortButton, ShortsList, ShortsListSkeleton } from "@/components/shorts-list";
import { timeAgo } from "@/lib/format";
import { unusedStories } from "@/lib/news/store";
import { getOverview, listShorts } from "@/lib/shorts";

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Every Short starts from a real AI story published in the last two days."
        actions={<NewShortButton />}
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}

async function OverviewContent() {
  await connection();
  const shorts = listShorts();
  const overview = getOverview(shorts);
  const stories = unusedStories(48, 6);

  const stats = [
    { label: "Shorts made", value: overview.total },
    { label: "Rendered", value: overview.rendered },
    { label: "Ready to render", value: overview.ready },
    { label: "Stories in queue", value: overview.queuedStories },
  ];

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col gap-1 px-5 py-4 ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
          >
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="font-mono text-2xl font-medium tabular-nums tracking-tight">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        <section className="lg:col-span-8">
          <SectionTitle
            action={
              shorts.length > 6 && (
                <Link href="/shorts" className="text-sm text-muted hover:text-fg">
                  View all
                </Link>
              )
            }
          >
            Recent Shorts
          </SectionTitle>
          <ShortsList shorts={shorts.slice(0, 6)} />
        </section>

        <section className="lg:col-span-4">
          <SectionTitle action={<RefreshNewsButton />}>Up next from the news</SectionTitle>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <StoryList stories={stories} empty="No unused stories. Refresh the news to pull the latest." />
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-subtle">
              <span>{overview.lastNewsAt ? `Fetched ${timeAgo(overview.lastNewsAt)}` : "Never fetched"}</span>
              <Link href="/news" className="text-muted hover:text-fg">
                Full queue
              </Link>
            </div>
          </div>
          {overview.sources.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-xs text-muted">Stories by source, last 48 hours</h3>
              <ul className="flex flex-wrap gap-1.5">
                {overview.sources.map((s) => (
                  <li key={s.source} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted">
                    {s.source} <span className="ml-1 font-mono tabular-nums text-fg">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true">
      <div className="skeleton h-[82px] rounded-xl" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8">
          <div className="mb-3 h-9" />
          <ShortsListSkeleton />
        </div>
        <div className="lg:col-span-4">
          <div className="mb-3 h-9" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
