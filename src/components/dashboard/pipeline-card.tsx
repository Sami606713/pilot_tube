import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PipelineStage = { label: string; count: number; href: string };

/** Horizontal bars, one per stage, scaled to the biggest stage. */
export function PipelineCard({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Production pipeline</CardTitle>
        <CardAction>
          <Link href="/shorts" aria-label="Open all Shorts" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ArrowUpRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {stages.map((stage) => (
            <li key={stage.label}>
              <Link href={stage.href} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 rounded-md text-sm hover:text-foreground sm:grid-cols-[9rem_1fr_2rem]">
                <span className="truncate text-muted-foreground">{stage.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-secondary" role="presentation">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${stage.count === 0 ? 0 : Math.max((stage.count / max) * 100, 4)}%` }}
                  />
                </span>
                <span className="text-right font-mono tabular-nums">{stage.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
