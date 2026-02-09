import { format, differenceInDays, setDate, addMonths, isBefore, startOfDay } from "date-fns";

/**
 * Get the next occurrence of a given day-of-month.
 * If today is past that day, return next month's occurrence.
 */
export function getNextDueDate(dayOfMonth: number): Date {
  const today = startOfDay(new Date());
  const thisMonth = setDate(today, Math.min(dayOfMonth, getDaysInMonth(today)));

  if (isBefore(thisMonth, today)) {
    const nextMonth = addMonths(today, 1);
    return setDate(nextMonth, Math.min(dayOfMonth, getDaysInMonth(nextMonth)));
  }
  return thisMonth;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Get days until a specific day-of-month.
 * Negative = overdue, 0 = today, positive = upcoming.
 */
export function getDaysUntilDue(dayOfMonth: number): number {
  const today = startOfDay(new Date());
  const nextDue = getNextDueDate(dayOfMonth);
  return differenceInDays(nextDue, today);
}

/**
 * Get urgency level based on days until due.
 */
export function getUrgencyLevel(daysUntil: number): "success" | "warning" | "urgent" | "critical" {
  if (daysUntil < 0) return "critical";
  if (daysUntil <= 1) return "urgent";
  if (daysUntil <= 3) return "warning";
  return "success";
}

/**
 * Format currency amount.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Calculate credit utilization percentage.
 */
export function getUtilization(balance: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.round((balance / limit) * 100);
}

/**
 * Get utilization color class.
 */
export function getUtilizationColor(pct: number): string {
  if (pct < 30) return "bg-success";
  if (pct < 50) return "bg-warning";
  return "bg-destructive";
}

export function formatDueDate(dayOfMonth: number): string {
  const next = getNextDueDate(dayOfMonth);
  return format(next, "MMM d, yyyy");
}
