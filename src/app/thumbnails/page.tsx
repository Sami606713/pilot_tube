import { ImageSquare } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Thumbnails" };

export default function ThumbnailsPage() {
  return (
    <ComingSoon
      title="Thumbnails"
      icon={<ImageSquare className="size-5" />}
      summary="Cover images for each Short."
      points={["Generate a cover frame from the hook card","Pick the best frame from the render","Upload a custom thumbnail with the video"]}
    />
  );
}
