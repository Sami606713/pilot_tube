import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Workflows" };

export default function WorkflowsPage() {
  return <PageHeader title="Workflows" />;
}
