import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Planner" };

export default function PlannerPage() {
  return <PageHeader title="Planner" />;
}
