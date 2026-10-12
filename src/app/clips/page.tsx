import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClipMaker } from "@/components/clips/clip-maker";
import { PageHeader } from "@/components/page-header";
import { listClips } from "@/lib/clips/clips";
import { listScripts, getScript } from "@/lib/scripts/store";
import { listThumbnails } from "@/lib/thumbnails/thumbnails";

export const metadata: Metadata = { title: "Clips" };

export default function ClipsPage() {
  return (
    <>
      <PageHeader title="Clips" description="AI video clips with Agnes Video 2.5: 4-12 seconds each, from a description or from a picture. Use them in the Video studio." />
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await connection();
  const scripts = listScripts()
    .filter((s) => s.status === "done")
    .flatMap((s) => {
      const c = getScript(s.id)?.content;
      return c ? [{ id: s.id, title: c.title, lines: c.lines.map((l) => ({ narration: l.narration, visual: l.visual.description })) }] : [];
    });
  const thumbnails = listThumbnails().map((t) => ({ id: t.id, shape: t.shape, concept: t.concept }));
  return <ClipMaker initial={listClips()} scripts={scripts} thumbnails={thumbnails} />;
}
