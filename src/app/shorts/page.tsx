import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Scripts" };

export default function ScriptsPage() {
  return <PageHeader title="Scripts" />;
}
