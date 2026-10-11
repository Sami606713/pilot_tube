"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DailyPoint } from "@/lib/youtube/analytics";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Metric = "views" | "subscribersGained";

const LABELS: Record<Metric, string> = { views: "Views", subscribersGained: "New subscribers" };

/**
 * One metric per day. Single series: no legend (the card title names it), solid recessive grid,
 * 2px line, crosshair tooltip on hover, and a table view so the tooltip is never the only way to read values.
 */
export function DailyChart({ data, metric, kind = "area", height = 220 }: { data: DailyPoint[]; metric: Metric; kind?: "area" | "bar"; height?: number }) {
  const config = { [metric]: { label: LABELS[metric], color: "var(--primary)" } } satisfies ChartConfig;
  const axis = { tickLine: false, axisLine: false, fontSize: 12 } as const;
  const tooltip = (
    <ChartTooltip
      cursor={kind === "area" ? { stroke: "var(--border-strong)", strokeWidth: 1 } : { fill: "var(--secondary)" }}
      content={<ChartTooltipContent labelFormatter={(v) => shortDate(String(v))} />}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <ChartContainer config={config} className="w-full" style={{ height }}>
        {kind === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${metric})`} stopOpacity={0.28} />
                <stop offset="100%" stopColor={`var(--color-${metric})`} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" {...axis} tickMargin={8} minTickGap={28} tickFormatter={shortDate} />
            <YAxis {...axis} width={36} allowDecimals={false} />
            {tooltip}
            <Area
              dataKey={metric}
              type="monotone"
              stroke={`var(--color-${metric})`}
              strokeWidth={2}
              fill={`url(#fill-${metric})`}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" {...axis} tickMargin={8} minTickGap={28} tickFormatter={shortDate} />
            <YAxis {...axis} width={36} allowDecimals={false} />
            {tooltip}
            <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ChartContainer>

      <details className="group text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer select-none hover:text-foreground">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="px-3 py-1.5 font-medium">Date</th>
                <th className="px-3 py-1.5 text-right font-medium">{LABELS[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="px-3 py-1">{shortDate(d.date)}</td>
                  <td className="px-3 py-1 text-right text-foreground tabular-nums">{d[metric]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
