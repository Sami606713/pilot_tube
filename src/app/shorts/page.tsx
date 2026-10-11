import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { NewShortButton, ShortsList, ShortsListSkeleton } from "@/components/shorts-list";
import { listShorts } from "@/lib/shorts";

export const metadata: Metadata = { title: "Shorts" };

export default function ShortsPage() {
  return (
    <>
      <PageHeader title="Shorts" description="Open a Short to run its next step, preview it, or redo any part." actions={<NewShortButton />} />
      <Suspense fallback={<ShortsListSkeleton rows={6} />}>
        <AllShorts />
      </Suspense>
    </>
  );
}

async function AllShorts() {
  await connection();
  return <ShortsList shorts={listShorts(200)} />;
}
