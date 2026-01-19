import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface GapRow {
  constraint: string;
  pdfValue: string;
  dbValue: string;
  status: "matched" | "missing" | "partial";
}

const gapData: GapRow[] = [
  {
    constraint: "Minimum Credit Rating",
    pdfValue: "BBB- or higher",
    dbValue: "BBB- or higher",
    status: "matched",
  },
  {
    constraint: "Maximum Single Issuer",
    pdfValue: "5%",
    dbValue: "5%",
    status: "matched",
  },
  {
    constraint: "Country Restriction - Russia",
    pdfValue: "Excluded",
    dbValue: "Excluded",
    status: "matched",
  },
  {
    constraint: "Sector Limit - Financials",
    pdfValue: "Max 25%",
    dbValue: "Max 25%",
    status: "matched",
  },
  {
    constraint: "Maximum Cash Position",
    pdfValue: "10%",
    dbValue: "10%",
    status: "matched",
  },
  {
    constraint: "ESG Exclusion - Tobacco",
    pdfValue: "Excluded",
    dbValue: "Excluded",
    status: "matched",
  },
];

export function GapAnalysisTable() {
  const statusConfig = {
    matched: { icon: CheckCircle, variant: "success" as const, label: "Matched" },
    missing: { icon: XCircle, variant: "destructive" as const, label: "Missing" },
    partial: { icon: AlertCircle, variant: "warning" as const, label: "Partial" },
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Constraint</TableHead>
            <TableHead className="font-semibold">PDF Value</TableHead>
            <TableHead className="font-semibold">DB Value</TableHead>
            <TableHead className="font-semibold text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gapData.map((row, idx) => {
            const status = statusConfig[row.status];
            const StatusIcon = status.icon;
            return (
              <TableRow key={idx}>
                <TableCell className="font-medium">{row.constraint}</TableCell>
                <TableCell className="text-muted-foreground">{row.pdfValue}</TableCell>
                <TableCell className={row.status !== "matched" ? "text-destructive" : "text-muted-foreground"}>
                  {row.dbValue}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={status.variant} className="gap-1">
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
