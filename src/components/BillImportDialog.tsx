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
import { useCreateBill } from "@/hooks/useBills";
import { useToast } from "@/hooks/use-toast";

interface BillImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedBill {
  bill_name: string;
  amount: number;
  due_day: number;
  frequency: string;
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
  billname: "bill_name",
  name: "bill_name",
  bill: "bill_name",
  amount: "amount",
  price: "amount",
  cost: "amount",
  dueday: "due_day",
  due: "due_day",
  day: "due_day",
  frequency: "frequency",
  freq: "frequency",
  recurring: "frequency",
  cycle: "frequency",
};

export function BillImportDialog({ open, onOpenChange }: BillImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedBills, setParsedBills] = useState<ParsedBill[]>([]);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const createBill = useCreateBill();
  const { toast } = useToast();

  const reset = () => {
    setFileName(null);
    setParsedBills([]);
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
      setParsedBills([]);
      return;
    }

    const headerCells = parseCSVLine(lines[0]);
    const colMap: Record<string, number> = {};
    headerCells.forEach((h, i) => {
      const key = HEADER_MAP[normalizeHeader(h)];
      if (key) colMap[key] = i;
    });

    if (!colMap.bill_name && !colMap.amount) {
      setErrors([{
        row: 1,
        message: `Could not detect columns. Use headers: name, amount, due_day, frequency. Found: ${headerCells.join(", ")}`,
      }]);
      setParsedBills([]);
      return;
    }

    const bills: ParsedBill[] = [];
    const issues: ValidationIssue[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      const rowNum = i + 1;

      const name = colMap.bill_name !== undefined ? cells[colMap.bill_name]?.trim() : "";
      const amountStr = colMap.amount !== undefined ? cells[colMap.amount]?.trim() : "";
      const dueDayStr = colMap.due_day !== undefined ? cells[colMap.due_day]?.trim() : "";
      const freq = colMap.frequency !== undefined ? cells[colMap.frequency]?.trim().toLowerCase() : "monthly";

      if (!name) {
        issues.push({ row: rowNum, message: "Missing bill name" });
        continue;
      }

      const amount = parseFloat(amountStr.replace(/[$,]/g, ""));
      if (isNaN(amount) || amount <= 0) {
        issues.push({ row: rowNum, message: `Invalid amount "${amountStr}" for ${name}` });
        continue;
      }

      let dueDay = parseInt(dueDayStr);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
        issues.push({ row: rowNum, message: `Invalid due day "${dueDayStr}" for ${name}, defaulting to 1` });
        dueDay = 1;
      }

      const validFreqs = ["weekly", "monthly", "quarterly"];
      const frequency = validFreqs.includes(freq) ? freq : "monthly";

      bills.push({ bill_name: name, amount, due_day: dueDay, frequency });
    }

    setParsedBills(bills);
    setErrors(issues);
  };

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const bill of parsedBills) {
      try {
        await createBill.mutateAsync(bill);
        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);

    if (success > 0) {
      toast({ title: `Imported ${success} bill${success > 1 ? "s" : ""}` });
    }
    if (failed > 0) {
      toast({ title: `${failed} bill${failed > 1 ? "s" : ""} failed to import`, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Bills from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: <strong>name</strong>, <strong>amount</strong>, <strong>due_day</strong>, <strong>frequency</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Errors */}
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

          {/* Preview */}
          {parsedBills.length > 0 && !importResult && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" />
                {parsedBills.length} bill{parsedBills.length > 1 ? "s" : ""} ready to import
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Name</th>
                      <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                      <th className="px-3 py-1.5 text-right font-medium">Due Day</th>
                      <th className="px-3 py-1.5 text-left font-medium">Freq</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBills.map((b, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{b.bill_name}</td>
                        <td className="px-3 py-1.5 text-right font-mono">${b.amount.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right">{b.due_day}</td>
                        <td className="px-3 py-1.5 capitalize">{b.frequency}</td>
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
            {parsedBills.length > 0 && !importResult && (
              <Button onClick={handleImport} disabled={importing}>
                <FileText className="mr-1 h-4 w-4" />
                {importing ? "Importing..." : `Import ${parsedBills.length} Bill${parsedBills.length > 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
