import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ScriptView, type FactInfo } from "@/components/scripts/script-view";
import { getResearch } from "@/lib/research/store";
import { getScript } from "@/lib/scripts/store";

export const metadata: Metadata = { title: "Script" };

export default function ScriptPage({ params }: PageProps<"/shorts/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/shorts" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Scripts
      </Link>
      <Suspense fallback={<div className="skeleton h-96 rounded-xl" aria-busy="true" />}>
        {params.then(({ id }) => (
          <ScriptContent id={Number(id)} />
        ))}
      </Suspense>
    </div>
  );
}

async function ScriptContent({ id }: { id: number }) {
  await connection();
  const script = Number.isInteger(id) ? getScript(id) : null;
  if (!script) notFound();

  // The research facts each line relies on, so the page can show the proof.
  const research = script.researchId ? getResearch(script.researchId)?.result : null;
  const facts: Record<string, FactInfo> = {};
  for (const f of research?.facts ?? []) {
    facts[f.id] = {
      id: f.id,
      statement: f.statement,
      status: f.status,
      sources: f.sources.map((n) => research!.sources.find((s) => s.n === n)?.domain ?? `#${n}`),
    };
  }
  return <ScriptView key={`${script.id}-${script.status}`} initial={script} facts={facts} />;
}
