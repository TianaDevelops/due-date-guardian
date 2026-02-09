import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateBill, useUpdateBill, type Bill } from "@/hooks/useBills";
import { useToast } from "@/hooks/use-toast";

interface BillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: Bill | null;
}

export function BillDialog({ open, onOpenChange, bill }: BillDialogProps) {
  const [form, setForm] = useState({
    bill_name: "",
    amount: 0,
    due_day: 1,
    frequency: "monthly" as string,
  });

  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const { toast } = useToast();
  const isEditing = !!bill;

  useEffect(() => {
    if (bill) {
      setForm({
        bill_name: bill.bill_name,
        amount: bill.amount,
        due_day: bill.due_day,
        frequency: bill.frequency,
      });
    } else {
      setForm({ bill_name: "", amount: 0, due_day: 1, frequency: "monthly" });
    }
  }, [bill, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && bill) {
        await updateBill.mutateAsync({ id: bill.id, ...form });
        toast({ title: "Bill updated" });
      } else {
        await createBill.mutateAsync(form);
        toast({ title: "Bill added" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const setField = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Bill" : "Add Bill"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update bill details below." : "Enter your recurring bill details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Bill Name</Label>
            <Input
              placeholder="e.g. Rent, Netflix"
              value={form.bill_name}
              onChange={(e) => setField("bill_name", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.amount}
                onChange={(e) => setField("amount", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Due Day</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.due_day}
                onChange={(e) => setField("due_day", parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={(v) => setField("frequency", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBill.isPending || updateBill.isPending}>
              {isEditing ? "Save Changes" : "Add Bill"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
