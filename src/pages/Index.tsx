import { useCreditCards } from "@/hooks/useCreditCards";
import { useBills } from "@/hooks/useBills";
import { useNotifications } from "@/hooks/useNotifications";
import { getDaysUntilDue, formatCurrency, getUtilization, formatDueDate } from "@/lib/dates";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { UtilizationBar } from "@/components/UtilizationBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, Receipt, AlertTriangle, Plus, Clock, DollarSign, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { CreditCardDialog } from "@/components/CreditCardDialog";
import { BillDialog } from "@/components/BillDialog";

export default function Dashboard() {
  const { data: cards = [], isLoading: cardsLoading } = useCreditCards();
  const { data: bills = [], isLoading: billsLoading } = useBills();
  const { data: notifications = [] } = useNotifications();
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [billDialogOpen, setBillDialogOpen] = useState(false);

  const totalBalance = cards.reduce((sum, c) => sum + Number(c.current_balance), 0);
  const totalLimit = cards.reduce((sum, c) => sum + Number(c.credit_limit), 0);
  const monthlyBills = bills
    .filter((b) => !b.is_paid_this_cycle)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  // Find next upcoming payment across cards and bills
  const allDue = [
    ...cards.map((c) => ({ name: c.card_name, day: c.payment_due_day, type: "card" as const })),
    ...bills.filter((b) => !b.is_paid_this_cycle).map((b) => ({ name: b.bill_name, day: b.due_day, type: "bill" as const })),
  ]
    .map((item) => ({ ...item, daysUntil: getDaysUntilDue(item.day) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const nextDue = allDue[0];

  // Overdue / urgent items
  const urgentItems = allDue.filter((item) => item.daysUntil <= 3);

  const isLoading = cardsLoading || billsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your payment overview</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCardDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Card
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBillDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Bill
          </Button>
        </div>
      </div>

      {/* Urgent alert banner */}
      {urgentItems.length > 0 && (
        <Alert className="border-urgent/30 bg-urgent/5">
          <AlertTriangle className="h-4 w-4 text-urgent" />
          <AlertTitle className="text-urgent">Upcoming payments need attention</AlertTitle>
          <AlertDescription className="text-urgent/80">
            {urgentItems.map((item) => (
              <span key={item.name} className="mr-3">
                <strong>{item.name}</strong> — {item.daysUntil < 0 ? `${Math.abs(item.daysUntil)}d overdue` : item.daysUntil === 0 ? "due today" : `${item.daysUntil}d left`}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Payment</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {nextDue ? (
              <>
                <div className="text-lg font-bold">{nextDue.name}</div>
                <UrgencyBadge daysUntil={nextDue.daysUntil} className="mt-1" />
              </>
            ) : (
              <div className="text-lg font-bold text-muted-foreground">No upcoming</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Card Balances</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono">{formatCurrency(totalBalance)}</div>
            <UtilizationBar balance={totalBalance} limit={totalLimit} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unpaid Bills</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono">{formatCurrency(monthlyBills)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {bills.filter((b) => !b.is_paid_this_cycle).length} bills remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Owed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold font-mono">
              {formatCurrency(totalBalance + monthlyBills)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Cards + bills combined</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming timeline */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Credit Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Credit Cards</CardTitle>
            <Link to="/cards">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cards added yet.</p>
            ) : (
              cards.slice(0, 5).map((card) => {
                const daysUntil = getDaysUntilDue(card.payment_due_day);
                return (
                  <div key={card.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <span className="font-medium truncate">{card.card_name}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Due {formatDueDate(card.payment_due_day)}</span>
                        <span>•</span>
                        <span className="font-mono">{formatCurrency(Number(card.current_balance))}</span>
                      </div>
                    </div>
                    <UrgencyBadge daysUntil={daysUntil} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Bills */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Bills</CardTitle>
            <Link to="/bills">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bills added yet.</p>
            ) : (
              bills.slice(0, 5).map((bill) => {
                const daysUntil = getDaysUntilDue(bill.due_day);
                return (
                  <div key={bill.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="font-medium truncate">{bill.bill_name}</span>
                        {bill.is_paid_this_cycle && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                            PAID
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Due {formatDueDate(bill.due_day)}</span>
                        <span>•</span>
                        <span className="font-mono">{formatCurrency(Number(bill.amount))}</span>
                        <span>•</span>
                        <span className="capitalize">{bill.frequency}</span>
                      </div>
                    </div>
                    {!bill.is_paid_this_cycle && <UrgencyBadge daysUntil={daysUntil} />}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <CreditCardDialog open={cardDialogOpen} onOpenChange={setCardDialogOpen} />
      <BillDialog open={billDialogOpen} onOpenChange={setBillDialogOpen} />
    </div>
  );
}
