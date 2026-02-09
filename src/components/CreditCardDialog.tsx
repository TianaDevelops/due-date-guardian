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
import { useCreateCreditCard, useUpdateCreditCard, type CreditCard } from "@/hooks/useCreditCards";
import { useToast } from "@/hooks/use-toast";

interface CreditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
}

export function CreditCardDialog({ open, onOpenChange, card }: CreditCardDialogProps) {
  const [form, setForm] = useState({
    card_name: "",
    issuer: "",
    statement_closing_day: 1,
    payment_due_day: 1,
    credit_limit: 0,
    current_balance: 0,
    minimum_payment: 0,
    apr: 0,
  });

  const createCard = useCreateCreditCard();
  const updateCard = useUpdateCreditCard();
  const { toast } = useToast();
  const isEditing = !!card;

  useEffect(() => {
    if (card) {
      setForm({
        card_name: card.card_name,
        issuer: card.issuer ?? "",
        statement_closing_day: card.statement_closing_day,
        payment_due_day: card.payment_due_day,
        credit_limit: card.credit_limit,
        current_balance: card.current_balance,
        minimum_payment: card.minimum_payment,
        apr: card.apr,
      });
    } else {
      setForm({
        card_name: "",
        issuer: "",
        statement_closing_day: 1,
        payment_due_day: 1,
        credit_limit: 0,
        current_balance: 0,
        minimum_payment: 0,
        apr: 0,
      });
    }
  }, [card, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && card) {
        await updateCard.mutateAsync({ id: card.id, ...form });
        toast({ title: "Card updated" });
      } else {
        await createCard.mutateAsync(form);
        toast({ title: "Card added" });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Credit Card" : "Add Credit Card"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update card details below." : "Enter your credit card details."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Card Name</Label>
              <Input
                placeholder="e.g. Chase Freedom"
                value={form.card_name}
                onChange={(e) => setField("card_name", e.target.value)}
                required
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Issuer</Label>
              <Input
                placeholder="e.g. Chase"
                value={form.issuer}
                onChange={(e) => setField("issuer", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Statement Close Day</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.statement_closing_day}
                onChange={(e) => setField("statement_closing_day", parseInt(e.target.value) || 1)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Due Day</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.payment_due_day}
                onChange={(e) => setField("payment_due_day", parseInt(e.target.value) || 1)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Credit Limit ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.credit_limit}
                onChange={(e) => setField("credit_limit", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Current Balance ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.current_balance}
                onChange={(e) => setField("current_balance", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Payment ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.minimum_payment}
                onChange={(e) => setField("minimum_payment", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>APR (%)</Label>
              <Input
                type="number"
                min={0}
                max={99.99}
                step={0.01}
                value={form.apr}
                onChange={(e) => setField("apr", parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCard.isPending || updateCard.isPending}>
              {isEditing ? "Save Changes" : "Add Card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
