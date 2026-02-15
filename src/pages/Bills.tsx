import { useState } from "react";
import { useBills, useUpdateBill, useDeleteBill, type Bill } from "@/hooks/useBills";
import { getDaysUntilDue, formatCurrency, formatDueDate } from "@/lib/dates";
import { UrgencyBadge } from "@/components/UrgencyBadge";
import { BillDialog } from "@/components/BillDialog";
import { BillImportDialog } from "@/components/BillImportDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Receipt, Check, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      await updateBill.mutateAsync({
        id: bill.id,
        is_paid_this_cycle: !bill.is_paid_this_cycle,
      });
      toast({
        title: bill.is_paid_this_cycle ? "Marked as unpaid" : "Marked as paid",
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
                return (
                  <Card key={bill.id}>
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
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Due {formatDueDate(bill.due_day)}</span>
                          <span>•</span>
                          <span className="font-mono">{formatCurrency(Number(bill.amount))}</span>
                        </div>
                      </div>
                      <UrgencyBadge daysUntil={daysUntil} />
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
