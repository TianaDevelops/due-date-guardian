import { usePlaidAccounts, usePlaidLinkFlow, useRemovePlaidAccount, type PlaidAccount } from "@/hooks/usePlaid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Trash2, RefreshCw, DollarSign, CreditCard, Landmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(amount: number | null) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function accountTypeIcon(type: string) {
  if (type === "credit") return <CreditCard className="h-4 w-4" />;
  if (type === "investment") return <DollarSign className="h-4 w-4" />;
  return <Landmark className="h-4 w-4" />;
}

function accountTypeBadge(type: string, subtype: string | null) {
  const label = subtype ?? type;
  const colors: Record<string, string> = {
    checking: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    savings: "bg-green-500/10 text-green-600 dark:text-green-400",
    credit: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    investment: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${colors[label] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

export default function Banks() {
  const { data: items = [], isLoading } = usePlaidAccounts();
  const { openLink, loading: linkLoading } = usePlaidLinkFlow();
  const remove = useRemovePlaidAccount();
  const { toast } = useToast();

  const totalChecking = items
    .flatMap((i) => i.accounts)
    .filter((a) => a.subtype === "checking" || a.subtype === "savings")
    .reduce((sum, a) => sum + (a.balances.available ?? a.balances.current ?? 0), 0);

  const handleRemove = (id: string, name: string) => {
    remove.mutate(id, {
      onSuccess: () => toast({ title: `${name} disconnected` }),
      onError: () => toast({ title: "Error", description: "Could not remove account", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Bank Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Connect your bank to see real-time balances
          </p>
        </div>
        <Button onClick={openLink} disabled={linkLoading} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {linkLoading ? "Connecting..." : "Link Bank"}
        </Button>
      </div>

      {/* Summary card */}
      {items.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available Cash</p>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totalChecking)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading accounts...</p>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-14 w-14 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No banks connected</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Link your bank account to see real-time balances alongside your bills and credit cards.
            </p>
            <Button className="mt-6" onClick={openLink} disabled={linkLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Connect your first bank
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Linked institutions */}
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                {item.institution_name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <RefreshCw className="h-3 w-3" />
                Synced {formatDistanceToNow(new Date(item.last_synced), { addSuffix: true })}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(item.id, item.institution_name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(item.accounts as PlaidAccount[]).map((account) => (
              <div
                key={account.account_id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {accountTypeIcon(account.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{account.name}</span>
                      {accountTypeBadge(account.type, account.subtype)}
                    </div>
                    {account.official_name && (
                      <p className="text-xs text-muted-foreground">{account.official_name}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">
                    {formatCurrency(account.balances.available ?? account.balances.current)}
                  </p>
                  {account.balances.available !== null && account.balances.current !== null && (
                    <p className="text-xs text-muted-foreground">
                      Current: {formatCurrency(account.balances.current)}
                    </p>
                  )}
                  {account.balances.limit !== null && (
                    <p className="text-xs text-muted-foreground">
                      Limit: {formatCurrency(account.balances.limit)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Plaid disclosure */}
      <p className="text-center text-xs text-muted-foreground">
        Bank connections powered by{" "}
        <a href="https://plaid.com" target="_blank" rel="noopener noreferrer" className="underline">
          Plaid
        </a>
        . Your credentials are never stored by Legacy Growth Solutions.
      </p>
    </div>
  );
}
