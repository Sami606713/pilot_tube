import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Publishing" };

export default function PublishingPage() {
  return (
    <ComingSoon
      title="Publishing"
      icon={<PaperPlaneTilt className="size-5" />}
      summary="Send finished Shorts to YouTube through Composio."
      points={["Connect your YouTube channel","Upload as private, unlisted or public","Title, description, hashtags and credits filled in from the script"]}
    />
  );
}
