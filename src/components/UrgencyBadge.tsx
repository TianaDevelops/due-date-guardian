import { cn } from "@/lib/utils";

interface UrgencyBadgeProps {
  daysUntil: number;
  className?: string;
}

export function UrgencyBadge({ daysUntil, className }: UrgencyBadgeProps) {
  let label: string;
  let colorClass: string;

  if (daysUntil < 0) {
    const absDays = Math.abs(daysUntil);
    label = `${absDays}d overdue`;
    if (absDays >= 29) {
      colorClass = "bg-critical text-critical-foreground animate-pulse-urgent";
    } else if (absDays >= 15) {
      colorClass = "bg-critical text-critical-foreground";
    } else {
      colorClass = "bg-urgent text-urgent-foreground";
    }
  } else if (daysUntil === 0) {
    label = "Due today";
    colorClass = "bg-urgent text-urgent-foreground";
  } else if (daysUntil === 1) {
    label = "Due tomorrow";
    colorClass = "bg-warning text-warning-foreground";
  } else if (daysUntil <= 3) {
    label = `${daysUntil}d left`;
    colorClass = "bg-warning text-warning-foreground";
  } else if (daysUntil <= 7) {
    label = `${daysUntil}d left`;
    colorClass = "bg-accent text-accent-foreground";
  } else {
    label = `${daysUntil}d left`;
    colorClass = "bg-success/10 text-success";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
