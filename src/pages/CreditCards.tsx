import { useState } from "react";
import { useCreditCards, useDeleteCreditCard, useUpdateCreditCard, type CreditCard } from "@/hooks/useCreditCards";
import { getDaysUntilDue, formatCurrency, formatDueDate } from "@/lib/dates";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { UtilizationBar } from "@/components/UtilizationBar";
import { OverdueBanner, calcDaysOverdue } from "@/components/OverdueBanner";
import { CreditCardDialog } from "@/components/CreditCardDialog";
import { CreditCardImportDialog } from "@/components/CreditCardImportDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, CreditCard as CardIcon, Upload, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function CreditCards() {
  const { data: cards = [], isLoading } = useCreditCards();
  const deleteCard = useDeleteCreditCard();
  const updateCard = useUpdateCreditCard();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCard.mutateAsync(id);
      toast({ title: "Card deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleMarkPaid = async (card: CreditCard) => {
    try {
      await updateCard.mutateAsync({
        id: card.id,
        last_payment_date: format(new Date(), "yyyy-MM-dd"),
      });
      toast({ title: `${card.card_name} marked as paid` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingCard(null);
  };

  // Collect overdue cards for top banners
  const overdueCards = cards
    .map((c) => ({
      card: c,
      daysOverdue: calcDaysOverdue(c.payment_due_day, c.last_payment_date),
    }))
    .filter(({ daysOverdue }) => daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Credit Cards</h1>
          <p className="text-sm text-muted-foreground">Manage your credit cards and track utilization</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Card
          </Button>
        </div>
      </div>

      {/* Overdue summary banners */}
      {overdueCards.length > 0 && (
        <div className="space-y-2">
          {overdueCards.map(({ card, daysOverdue }) => (
            <OverdueBanner
              key={card.id}
              daysOverdue={daysOverdue}
              name={card.card_name}
              amount={Number(card.minimum_payment)}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CardIcon className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No credit cards yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Add your first card to start tracking</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Card
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const daysUntil = getDaysUntilDue(card.payment_due_day);
            const daysOverdue = calcDaysOverdue(card.payment_due_day, card.last_payment_date);
            const isPaidThisMonth = (() => {
              if (!card.last_payment_date) return false;
              const paid = new Date(card.last_payment_date);
              const now = new Date();
              return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
            })();

            return (
              <Card
                key={card.id}
                className={
                  daysOverdue >= 25
                    ? "overflow-hidden border-destructive/60"
                    : daysOverdue > 0
                    ? "overflow-hidden border-orange-400/60"
                    : "overflow-hidden"
                }
              >
                <div className="flex items-center justify-between border-b p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{card.card_name}</h3>
                      {daysOverdue >= 25 && (
                        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive animate-pulse">
                          Bureau Risk
                        </span>
                      )}
                    </div>
                    {card.issuer && (
                      <p className="text-xs text-muted-foreground">{card.issuer}</p>
                    )}
                    {isPaidThisMonth && (
                      <p className="text-xs text-success font-medium">
                        ✓ Paid {card.last_payment_date}
                      </p>
                    )}
                    {daysOverdue > 0 && (
                      <p className={`text-xs font-semibold ${daysOverdue >= 14 ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}>
                        {daysOverdue}d overdue
                      </p>
                    )}
                  </div>
                  <UrgencyBadge daysUntil={daysOverdue > 0 ? -daysOverdue : daysUntil} />
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Balance</span>
                      <p className="font-mono font-semibold">{formatCurrency(Number(card.current_balance))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Limit</span>
                      <p className="font-mono font-semibold">{formatCurrency(Number(card.credit_limit))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Min Payment</span>
                      <p className="font-mono font-semibold">{formatCurrency(Number(card.minimum_payment))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">APR</span>
                      <p className="font-mono font-semibold">{Number(card.apr)}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statement Close</span>
                      <p className="font-semibold">Day {card.statement_closing_day}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Due Date</span>
                      <p className="font-semibold">{formatDueDate(card.payment_due_day)}</p>
                    </div>
                  </div>

                  <UtilizationBar balance={Number(card.current_balance)} limit={Number(card.credit_limit)} />

                  <div className="flex gap-2">
                    {/* Mark Paid button — shown when overdue or not yet paid this month */}
                    {!isPaidThisMonth && (
                      <Button
                        size="sm"
                        variant={daysOverdue > 0 ? "default" : "outline"}
                        className={`flex-1 ${daysOverdue > 0 ? "bg-success hover:bg-success/90 text-success-foreground" : ""}`}
                        onClick={() => handleMarkPaid(card)}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Mark Paid
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className={isPaidThisMonth ? "flex-1" : ""} onClick={() => handleEdit(card)}>
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDelete(card.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreditCardDialog open={dialogOpen} onOpenChange={handleDialogClose} card={editingCard} />
      <CreditCardImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
