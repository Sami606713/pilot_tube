import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshNewsButton } from "@/components/news-queue";
import { PageHeader } from "@/components/page-header";
import { ResearchExplorer } from "@/components/research/research-explorer";
import { StoryCardSkeleton } from "@/components/research/story-card";

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        title="Research"
        description="Find the AI stories worth a Short. Search any topic live, filter by time, and turn any story into a Short."
        actions={<RefreshNewsButton />}
      />
      {/* The explorer reads its filters from the URL, which is request-time data. */}
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true">
            <div className="skeleton h-12 rounded-xl" />
            {Array.from({ length: 4 }, (_, i) => (
              <StoryCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <ResearchExplorer />
      </Suspense>
    </>
  );
}
