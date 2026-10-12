import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Publishing" };

export default function PublishingPage() {
  return <PageHeader title="Publishing" />;
}
