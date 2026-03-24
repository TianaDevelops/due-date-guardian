import { AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OverdueBannerProps {
  daysOverdue: number;
  name: string;
  amount?: number;
  className?: string;
}

/**
 * Displays an overdue payment warning banner.
 * Escalates in severity at 1, 7, 14, and 25 days overdue.
 * At 25 days, shows a critical bureau-reporting warning.
 */
export function OverdueBanner({ daysOverdue, name, amount, className }: OverdueBannerProps) {
  if (daysOverdue <= 0) return null;

  const isUrgent = daysOverdue >= 25;
  const isCritical = daysOverdue >= 14;

  let message: string;
  let subMessage: string;

  if (daysOverdue >= 25) {
    message = `${daysOverdue} days overdue — URGENT`;
    subMessage = `Only ${30 - daysOverdue} day${30 - daysOverdue === 1 ? "" : "s"} until this may be reported to credit bureaus!`;
  } else if (daysOverdue >= 14) {
    message = `${daysOverdue} days overdue`;
    subMessage = "Pay now to protect your credit score before the 30-day reporting window.";
  } else if (daysOverdue >= 7) {
    message = `${daysOverdue} days overdue`;
    subMessage = "Missed payment — pay as soon as possible.";
  } else {
    message = `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`;
    subMessage = "Payment was missed — please pay now.";
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        isUrgent
          ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
          : isCritical
          ? "border-destructive/40 bg-destructive/8 text-destructive"
          : "border-orange-400/50 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
        className
      )}
    >
      {isUrgent ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">
          {name} — {message}
        </p>
        <p className="mt-0.5 text-xs opacity-90">{subMessage}</p>
      </div>
    </div>
  );
}

/**
 * Calculates how many days overdue a payment is.
 * Returns 0 if not overdue.
 * Uses last_payment_date if available; otherwise uses is_paid_this_cycle for bills.
 */
export function calcDaysOverdue(
  dueDay: number,
  lastPaymentDate?: string | null,
  isPaidThisCycle?: boolean
): number {
  const now = new Date();
  const today = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (today <= dueDay) return 0; // Not yet past due this month

  // For bills: if marked paid this cycle, not overdue
  if (isPaidThisCycle) return 0;

  // If paid this month via last_payment_date, not overdue
  if (lastPaymentDate) {
    const paid = new Date(lastPaymentDate);
    const firstOfMonth = new Date(year, month, 1);
    if (paid >= firstOfMonth) return 0;
  }

  const dueDate = new Date(year, month, dueDay);
  const todayDate = new Date(year, month, today);
  return Math.max(0, Math.round((todayDate.getTime() - dueDate.getTime()) / 86_400_000));
}
