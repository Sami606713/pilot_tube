import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Music" };

export default function MusicPage() {
  return <PageHeader title="Music" />;
}
