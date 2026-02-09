import { cn } from "@/lib/utils";
import { getUtilization, getUtilizationColor } from "@/lib/dates";

interface UtilizationBarProps {
  balance: number;
  limit: number;
  showLabel?: boolean;
  className?: string;
}

export function UtilizationBar({ balance, limit, showLabel = true, className }: UtilizationBarProps) {
  const pct = getUtilization(balance, limit);
  const colorClass = getUtilizationColor(pct);

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Utilization</span>
          <span className="font-mono font-medium">{pct}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
