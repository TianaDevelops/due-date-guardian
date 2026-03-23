import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCreateCreditCard } from "@/hooks/useCreditCards";
import { useToast } from "@/hooks/use-toast";

interface CreditCardImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCard {
  card_name: string;
  issuer: string;
  statement_closing_day: number;
  payment_due_day: number;
  credit_limit: number;
  current_balance: number;
  minimum_payment: number;
  apr: number;
}

interface ValidationIssue {
  row: number;
  message: string;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  // Card name
  cardname: "card_name",
  name: "card_name",
  card: "card_name",
  // Issuer / bank
  issuer: "issuer",
  bank: "issuer",
  // Statement closing day
  statementclosingday: "statement_closing_day",
  statementclose: "statement_closing_day",
  closingday: "statement_closing_day",
  closing: "statement_closing_day",
  statementday: "statement_closing_day",
  // Payment due day
  paymentdueday: "payment_due_day",
  dueday: "payment_due_day",
  due: "payment_due_day",
  paymentdue: "payment_due_day",
  // Credit limit
  creditlimit: "credit_limit",
  limit: "credit_limit",
  // Current balance
  currentbalance: "current_balance",
  balance: "current_balance",
  // Minimum payment
  minimumpayment: "minimum_payment",
  minpayment: "minimum_payment",
  minimum: "minimum_payment",
  min: "minimum_payment",
  // APR
  apr: "apr",
  rate: "apr",
  interestrate: "apr",
};

const SAMPLE_CSV = `card_name,issuer,statement_closing_day,payment_due_day,credit_limit,current_balance,minimum_payment,apr
Chase Freedom,Chase,15,10,5000,1200,35,19.99
Citi Double Cash,Citi,20,15,8000,3400,68,22.49`;

export function CreditCardImportDialog({ open, onOpenChange }: CreditCardImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const createCard = useCreateCreditCard();
  const { toast } = useToast();

  const reset = () => {
    setFileName(null);
    setParsedCards([]);
    setErrors([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setErrors([{ row: 0, message: "File must have a header row and at least one data row" }]);
      setParsedCards([]);
      return;
    }

    const headerCells = parseCSVLine(lines[0]);
    const colMap: Record<string, number> = {};
    headerCells.forEach((h, i) => {
      const key = HEADER_MAP[normalizeHeader(h)];
      if (key) colMap[key] = i;
    });

    if (colMap.card_name === undefined && colMap.credit_limit === undefined) {
      setErrors([{
        row: 1,
        message: `Could not detect columns. Use headers: card_name, issuer, statement_closing_day, payment_due_day, credit_limit, current_balance, minimum_payment, apr. Found: ${headerCells.join(", ")}`,
      }]);
      setParsedCards([]);
      return;
    }

    const cards: ParsedCard[] = [];
    const issues: ValidationIssue[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      const rowNum = i + 1;

      const name = colMap.card_name !== undefined ? cells[colMap.card_name]?.trim() : "";
      if (!name) {
        issues.push({ row: rowNum, message: "Missing card name" });
        continue;
      }

      const issuer = colMap.issuer !== undefined ? cells[colMap.issuer]?.trim() ?? "" : "";

      const statementClosingDayStr = colMap.statement_closing_day !== undefined ? cells[colMap.statement_closing_day]?.trim() : "";
      let statementClosingDay = parseInt(statementClosingDayStr);
      if (isNaN(statementClosingDay) || statementClosingDay < 1 || statementClosingDay > 31) {
        issues.push({ row: rowNum, message: `Invalid statement closing day "${statementClosingDayStr}" for ${name}, defaulting to 1` });
        statementClosingDay = 1;
      }

      const paymentDueDayStr = colMap.payment_due_day !== undefined ? cells[colMap.payment_due_day]?.trim() : "";
      let paymentDueDay = parseInt(paymentDueDayStr);
      if (isNaN(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31) {
        issues.push({ row: rowNum, message: `Invalid payment due day "${paymentDueDayStr}" for ${name}, defaulting to 1` });
        paymentDueDay = 1;
      }

      const creditLimitStr = colMap.credit_limit !== undefined ? cells[colMap.credit_limit]?.trim() : "0";
      const creditLimit = parseFloat(creditLimitStr.replace(/[$,]/g, ""));
      if (isNaN(creditLimit) || creditLimit < 0) {
        issues.push({ row: rowNum, message: `Invalid credit limit "${creditLimitStr}" for ${name}` });
        continue;
      }

      const currentBalanceStr = colMap.current_balance !== undefined ? cells[colMap.current_balance]?.trim() : "0";
      const currentBalance = parseFloat(currentBalanceStr.replace(/[$,]/g, "")) || 0;

      const minimumPaymentStr = colMap.minimum_payment !== undefined ? cells[colMap.minimum_payment]?.trim() : "0";
      const minimumPayment = parseFloat(minimumPaymentStr.replace(/[$,]/g, "")) || 0;

      const aprStr = colMap.apr !== undefined ? cells[colMap.apr]?.trim() : "0";
      const apr = parseFloat(aprStr.replace(/%/g, "")) || 0;

      cards.push({
        card_name: name,
        issuer,
        statement_closing_day: statementClosingDay,
        payment_due_day: paymentDueDay,
        credit_limit: creditLimit,
        current_balance: currentBalance,
        minimum_payment: minimumPayment,
        apr,
      });
    }

    setParsedCards(cards);
    setErrors(issues);
  };

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const card of parsedCards) {
      try {
        await createCard.mutateAsync(card);
        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);

    if (success > 0) {
      toast({ title: `Imported ${success} card${success > 1 ? "s" : ""}` });
    }
    if (failed > 0) {
      toast({ title: `${failed} card${failed > 1 ? "s" : ""} failed to import`, variant: "destructive" });
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credit_cards_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Credit Cards from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns: <strong>card_name</strong>, <strong>issuer</strong>, <strong>statement_closing_day</strong>, <strong>payment_due_day</strong>, <strong>credit_limit</strong>, <strong>current_balance</strong>, <strong>minimum_payment</strong>, <strong>apr</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sample download */}
          <button
            type="button"
            onClick={downloadSample}
            className="text-xs text-primary hover:underline"
          >
            Download sample CSV template
          </button>

          {/* File picker */}
          <div
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-primary/[0.03] p-8 transition-colors hover:border-primary/60"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-primary/60" />
            <p className="text-sm text-muted-foreground">
              {fileName ? fileName : "Click to select a CSV file"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Errors / warnings */}
          {errors.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-destructive/5 p-3">
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>Row {err.row}: {err.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Preview table */}
          {parsedCards.length > 0 && !importResult && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" />
                {parsedCards.length} card{parsedCards.length > 1 ? "s" : ""} ready to import
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Name</th>
                      <th className="px-3 py-1.5 text-right font-medium">Limit</th>
                      <th className="px-3 py-1.5 text-right font-medium">Balance</th>
                      <th className="px-3 py-1.5 text-right font-medium">Due Day</th>
                      <th className="px-3 py-1.5 text-right font-medium">APR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedCards.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 truncate max-w-[120px]">{c.card_name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">${c.credit_limit.toFixed(0)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">${c.current_balance.toFixed(0)}</td>
                        <td className="px-3 py-1.5 text-right">{c.payment_due_day}</td>
                        <td className="px-3 py-1.5 text-right">{c.apr}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="rounded-lg bg-success/5 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
              <p className="text-sm font-medium">
                {importResult.success} imported{importResult.failed > 0 && `, ${importResult.failed} failed`}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {parsedCards.length > 0 && !importResult && (
              <Button onClick={handleImport} disabled={importing}>
                <FileText className="mr-1 h-4 w-4" />
                {importing ? "Importing..." : `Import ${parsedCards.length} Card${parsedCards.length > 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
