import { useState } from "react";
import { useCreditCards } from "@/hooks/useCreditCards";
import { useBills } from "@/hooks/useBills";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Receipt } from "lucide-react";
import { format, setDate } from "date-fns";
import { formatCurrency } from "@/lib/dates";

export default function CalendarView() {
  const { data: cards = [] } = useCreditCards();
  const { data: bills = [] } = useBills();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const currentMonth = selectedDate ?? new Date();

  // Build a map of day -> items for the current month
  const dayItems: Record<number, Array<{ name: string; type: "card_due" | "card_statement" | "bill"; amount?: number }>> = {};

  cards.forEach((card) => {
    const dueDay = card.payment_due_day;
    if (!dayItems[dueDay]) dayItems[dueDay] = [];
    dayItems[dueDay].push({
      name: `${card.card_name} (payment due)`,
      type: "card_due",
      amount: Number(card.minimum_payment),
    });

    const stmtDay = card.statement_closing_day;
    if (!dayItems[stmtDay]) dayItems[stmtDay] = [];
    dayItems[stmtDay].push({
      name: `${card.card_name} (statement close)`,
      type: "card_statement",
    });
  });

  bills.forEach((bill) => {
    if (!dayItems[bill.due_day]) dayItems[bill.due_day] = [];
    dayItems[bill.due_day].push({
      name: bill.bill_name,
      type: "bill",
      amount: Number(bill.amount),
    });
  });

  const selectedDay = selectedDate?.getDate();
  const selectedItems = selectedDay ? dayItems[selectedDay] ?? [] : [];

  // Days with events for highlighting
  const daysWithEvents = Object.keys(dayItems).map((d) => {
    try {
      return setDate(currentMonth, parseInt(d));
    } catch {
      return null;
    }
  }).filter(Boolean) as Date[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Calendar</h1>
        <p className="text-sm text-muted-foreground">View all payment dates at a glance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="w-fit">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ event: daysWithEvents }}
              modifiersClassNames={{
                event: "bg-primary/10 font-bold text-primary",
              }}
              className="pointer-events-auto"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedDate
                ? format(selectedDate, "EEEE, MMMM d, yyyy")
                : "Select a date"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments on this date.</p>
            ) : (
              selectedItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {item.type === "bill" ? (
                    <Receipt className="h-5 w-5 text-warning" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-primary" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.amount !== undefined && (
                      <p className="text-xs font-mono text-muted-foreground">
                        {formatCurrency(item.amount)}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      item.type === "bill"
                        ? "border-warning/30 text-warning"
                        : item.type === "card_due"
                        ? "border-primary/30 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }
                  >
                    {item.type === "bill" ? "Bill" : item.type === "card_due" ? "Card Due" : "Statement"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
