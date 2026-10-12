import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PlannerBoard } from "@/components/planner/planner-board";
import { getDb } from "@/lib/db";
import { addDays, getPostTime, getWeek, localDay, weekStart } from "@/lib/planner/planner";
import { listResearch } from "@/lib/research/store";
import { listScripts } from "@/lib/scripts/store";

export const metadata: Metadata = { title: "Planner" };

export default function PlannerPage({ searchParams }: PageProps<"/planner">) {
  return (
    <>
      <PageHeader title="Planner" description="One Short a day. Plan topics ahead, see each day's progress, and schedule finished videos at your post time." />
      <Suspense fallback={<div className="skeleton h-80 rounded-xl" aria-busy="true" />}>
        {searchParams.then((sp) => (
          <Content week={Array.isArray(sp.week) ? sp.week[0] : sp.week} />
        ))}
      </Suspense>
    </>
  );
}

async function Content({ week: requested }: { week?: string }) {
  await connection();
  const start = weekStart(requested);
  const planned = new Set((getDb().prepare(`SELECT script_id FROM plan_slots WHERE script_id IS NOT NULL`).all() as { script_id: number }[]).map((r) => r.script_id));
  return (
    <PlannerBoard
      week={getWeek(start)}
      prevWeek={addDays(start, -7)}
      nextWeek={addDays(start, 7)}
      isThisWeek={start === weekStart()}
      today={localDay(new Date())}
      postTime={getPostTime()}
      research={listResearch()
        .filter((r) => r.status === "done")
        .map((r) => ({ id: r.id, title: r.title ?? r.topic }))}
      scripts={listScripts()
        .filter((s) => s.status === "done" && !planned.has(s.id))
        .map((s) => ({ id: s.id, title: s.title ?? s.topic }))}
    />
  );
}
