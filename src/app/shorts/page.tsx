import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { NewShortButton, ShortsList, ShortsListSkeleton } from "@/components/shorts-list";
import { listShorts } from "@/lib/shorts";

export const metadata: Metadata = { title: "Scripts" };

export default function ShortsPage() {
  return (
    <>
      <PageHeader title="Scripts" description="Every Short from script to render. Open one to run its next step or preview it." actions={<NewShortButton />} />
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
