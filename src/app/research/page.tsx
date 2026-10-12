import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ResearchWorkspace } from "@/components/research/research-workspace";
import { listResearch } from "@/lib/research/store";

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage({ searchParams }: PageProps<"/research">) {
  return (
    <>
      <PageHeader
        title="Research"
        description="Deep, fact-checked research on any AI topic: real sources, word-for-word quotes, cross-checked facts and a cited report."
      />
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        {searchParams.then((sp) => (
          <ResearchContent id={Number(Array.isArray(sp.id) ? sp.id[0] : sp.id) || null} />
        ))}
      </Suspense>
    </>
  );
}

async function ResearchContent({ id }: { id: number | null }) {
  await connection();
  return <ResearchWorkspace initialHistory={listResearch()} initialId={id} />;
}
