import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ThumbnailMaker } from "@/components/thumbnails/thumbnail-maker";
import { listScripts } from "@/lib/scripts/store";
import { listThumbnails } from "@/lib/thumbnails/thumbnails";

export const metadata: Metadata = { title: "Thumbnails" };

export default function ThumbnailsPage() {
  return (
    <>
      <PageHeader
        title="Thumbnails"
        description="Clear, eye-catching pictures for your videos, or from your own idea. 9:16 for Shorts or 16:9 for YouTube; any text is added by PilotTube, never misspelled."
      />
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await connection();
  const videos = listScripts()
    .filter((s) => s.status === "done")
    .map((s) => ({ id: s.id, title: s.title ?? s.topic }));
  return <ThumbnailMaker videos={videos} thumbnails={listThumbnails()} />;
}
