import { useState } from "react";
import { useCreditCards, useDeleteCreditCard, type CreditCard } from "@/hooks/useCreditCards";
import { getDaysUntilDue, formatCurrency, formatDueDate } from "@/lib/dates";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { UtilizationBar } from "@/components/UtilizationBar";
import { CreditCardDialog } from "@/components/CreditCardDialog";
import { CreditCardImportDialog } from "@/components/CreditCardImportDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, CreditCard as CardIcon, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CreditCards() {
  const { data: cards = [], isLoading } = useCreditCards();
  const deleteCard = useDeleteCreditCard();
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

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingCard(null);
  };

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
            return (
              <Card key={card.id} className="overflow-hidden">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{card.card_name}</h3>
                    {card.issuer && (
                      <p className="text-xs text-muted-foreground">{card.issuer}</p>
                    )}
                  </div>
                  <UrgencyBadge daysUntil={daysUntil} />
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
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(card)}>
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
