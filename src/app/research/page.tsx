import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage() {
  return <PageHeader title="Research" />;
}
