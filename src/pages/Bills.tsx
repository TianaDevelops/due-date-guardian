import { useState } from "react";
import { useBills, useUpdateBill, useDeleteBill, type Bill } from "@/hooks/useBills";
import { getDaysUntilDue, formatCurrency, formatDueDate } from "@/lib/dates";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { OverdueBanner, calcDaysOverdue } from "@/components/OverdueBanner";
import { BillDialog } from "@/components/BillDialog";
import { BillImportDialog } from "@/components/BillImportDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Receipt, Check, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Bills() {
  const { data: bills = [], isLoading } = useBills();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBill.mutateAsync(id);
      toast({ title: "Bill deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleTogglePaid = async (bill: Bill) => {
    try {
      const nowPaid = !bill.is_paid_this_cycle;
      await updateBill.mutateAsync({
        id: bill.id,
        is_paid_this_cycle: nowPaid,
        // Record payment date when marking as paid; clear it when unmarking
        last_payment_date: nowPaid ? format(new Date(), "yyyy-MM-dd") : null,
      });
      toast({
        title: nowPaid ? "Marked as paid" : "Marked as unpaid",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingBill(null);
  };

  const unpaidBills = bills.filter((b) => !b.is_paid_this_cycle);
  const paidBills = bills.filter((b) => b.is_paid_this_cycle);

  // Collect overdue bills for the top banner
  const overdueBills = unpaidBills
    .map((b) => ({
      bill: b,
      daysOverdue: calcDaysOverdue(b.due_day, b.last_payment_date, b.is_paid_this_cycle),
    }))
    .filter(({ daysOverdue }) => daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Bills</h1>
          <p className="text-sm text-muted-foreground">Track your recurring bills and payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Bill
          </Button>
        </div>
      </div>

      {/* Overdue summary banners */}
      {overdueBills.length > 0 && (
        <div className="space-y-2">
          {overdueBills.map(({ bill, daysOverdue }) => (
            <OverdueBanner
              key={bill.id}
              daysOverdue={daysOverdue}
              name={bill.bill_name}
              amount={Number(bill.amount)}
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : bills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No bills yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Add your first bill to start tracking</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Unpaid bills */}
          {unpaidBills.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Unpaid ({unpaidBills.length})
              </h2>
              {unpaidBills.map((bill) => {
                const daysUntil = getDaysUntilDue(bill.due_day);
                const daysOverdue = calcDaysOverdue(bill.due_day, bill.last_payment_date, bill.is_paid_this_cycle);
                return (
                  <Card
                    key={bill.id}
                    className={daysOverdue >= 25 ? "border-destructive/60" : daysOverdue > 0 ? "border-orange-400/60" : ""}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <button
                        onClick={() => handleTogglePaid(bill)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 transition-colors hover:border-success hover:bg-success/10"
                      >
                        <Check className="h-4 w-4 text-transparent" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{bill.bill_name}</span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                            {bill.frequency}
                          </span>
                          {daysOverdue >= 25 && (
                            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive animate-pulse">
                              Bureau Risk
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Due {formatDueDate(bill.due_day)}</span>
                          <span>•</span>
                          <span className="font-mono">{formatCurrency(Number(bill.amount))}</span>
                          {daysOverdue > 0 && (
                            <>
                              <span>•</span>
                              <span className={daysOverdue >= 14 ? "font-semibold text-destructive" : "font-semibold text-orange-600 dark:text-orange-400"}>
                                {daysOverdue}d overdue
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <UrgencyBadge daysUntil={daysOverdue > 0 ? -daysOverdue : daysUntil} />
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(bill)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(bill.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Paid bills */}
          {paidBills.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Paid ({paidBills.length})
              </h2>
              {paidBills.map((bill) => (
                <Card key={bill.id} className="opacity-60">
                  <CardContent className="flex items-center gap-4 p-4">
                    <button
                      onClick={() => handleTogglePaid(bill)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-success bg-success/10"
                    >
                      <Check className="h-4 w-4 text-success" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium line-through">{bill.bill_name}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{formatCurrency(Number(bill.amount))}</span>
                        {bill.last_payment_date && (
                          <span className="ml-2">Paid {bill.last_payment_date}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(bill)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(bill.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <BillDialog open={dialogOpen} onOpenChange={handleDialogClose} bill={editingBill} />
      <BillImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
