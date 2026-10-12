import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Studio } from "@/components/studio/studio";
import { listClips } from "@/lib/clips/clips";
import { listScripts } from "@/lib/scripts/store";
import { buildProps } from "@/lib/studio/engine";
import { getProject } from "@/lib/studio/store";

export const metadata: Metadata = { title: "Video studio" };

export default function StudioPage({ searchParams }: PageProps<"/studio">) {
  return (
    <>
      <PageHeader title="Video studio" description="Turn a script into a 1080×1920 Short: voice, captions, footage for every line, preview, then render." />
      <Suspense fallback={<div className="skeleton h-[600px] rounded-xl" aria-busy="true" />}>
        {searchParams.then((sp) => (
          <StudioContent scriptId={Number(Array.isArray(sp.script) ? sp.script[0] : sp.script) || null} />
        ))}
      </Suspense>
    </>
  );
}

async function StudioContent({ scriptId }: { scriptId: number | null }) {
  await connection();
  const scripts = listScripts()
    .filter((s) => s.status === "done")
    .map((s) => ({ id: s.id, title: s.title ?? s.topic }));
  const project = scriptId ? getProject(scriptId) : null;
  const initial = project ? { project, props: buildProps(project, `/api/studio/${project.scriptId}/file`) } : null;
  const clips = listClips()
    .filter((c) => c.state === "done")
    .map((c) => ({ id: c.id, prompt: c.prompt, shape: c.shape, duration: c.duration ?? c.seconds }));
  return <Studio key={scriptId ?? 0} scripts={scripts} clips={clips} scriptId={scriptId} initial={initial} />;
}
