import { FlowArrow } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Workflows" };

export default function WorkflowsPage() {
  return (
    <ComingSoon
      title="Workflows"
      icon={<FlowArrow className="size-5" />}
      summary="Run the whole pipeline on a schedule."
      points={["Every morning: fetch news, write, voice, cut and render","Notify you when a Short is ready to review","Optional auto-publish after review"]}
    />
  );
}
