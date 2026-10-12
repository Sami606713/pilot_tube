import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Video studio" };

export default function StudioPage() {
  return <PageHeader title="Video studio" />;
}
