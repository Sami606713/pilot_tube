import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Planner" };

export default function PlannerPage() {
  return (
    <ComingSoon
      title="Planner"
      icon={<CalendarBlank className="size-5" />}
      summary="Plan which stories become Shorts and when they go out."
      points={["A weekly calendar of upcoming Shorts","Pick or skip stories from the news queue ahead of time","Set a daily posting time"]}
    />
  );
}
