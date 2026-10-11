import { ArrowDownRight, ArrowUpRight, Minus } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";

/** "+12.8%" / "-4%" against the previous period; an arrow and the sign carry direction, not just color. */
function Change({ value, period }: { value: number | null; period: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground">New this {period}</span>;
  const rounded = Math.abs(value) < 10 ? value.toFixed(1) : Math.round(value).toString();
  if (Math.abs(value) < 0.05)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3.5" /> Same as previous {period}
      </span>
    );
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>
      {up ? <ArrowUpRight weight="bold" className="size-3.5" /> : <ArrowDownRight weight="bold" className="size-3.5" />}
      {up ? "+" : ""}
      {rounded}% <span className="font-normal text-muted-foreground">vs previous {period}</span>
    </span>
  );
}

export function StatCard({ label, value, note, change, period = "28 days" }: { label: string; value: string; note?: string; change?: number | null; period?: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight sm:text-[28px]">{value}</span>
        {change !== undefined ? <Change value={change} period={period} /> : <span className="text-xs text-muted-foreground">{note}</span>}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return <div className="skeleton h-[118px] rounded-xl" />;
}
