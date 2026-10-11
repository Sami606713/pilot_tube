import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Placeholder for sidebar pages that are planned but not built yet. */
export function ComingSoon({ title, icon, summary, points }: { title: string; icon: ReactNode; summary: string; points: string[] }) {
  return (
    <>
      <PageHeader title={title} description={summary} actions={<Badge variant="outline">Soon</Badge>} />
      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-5">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</span>
          <div className="flex flex-col gap-2">
            <h2 className="font-medium">What this page will do</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <Button variant="outline" asChild className="w-fit">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
