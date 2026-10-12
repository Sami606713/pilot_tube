import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Thumbnails" };

export default function ThumbnailsPage() {
  return <PageHeader title="Thumbnails" />;
}
