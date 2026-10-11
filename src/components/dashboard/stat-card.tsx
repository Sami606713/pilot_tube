import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  note,
  trend,
  sample,
}: {
  label: string;
  value: string;
  note?: string;
  /** e.g. "+12.8%", shown in green. */
  trend?: string;
  /** Placeholder numbers until YouTube is connected. */
  sample?: boolean;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {sample && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal text-subtle" title="Example numbers until YouTube is connected">
              Sample
            </Badge>
          )}
        </div>
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px]">{value}</span>
        {trend ? (
          <span className="text-xs font-medium text-success">{trend}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{note}</span>
        )}
      </CardContent>
    </Card>
  );
}
