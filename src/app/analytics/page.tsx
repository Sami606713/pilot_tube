import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      icon={<ChartLineUp className="size-5" />}
      summary="How your Shorts perform after they go live."
      points={["Views, watch time and subscribers per Short","Which topics and hooks work best","Replaces the sample numbers on the dashboard"]}
    />
  );
}
