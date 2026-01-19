import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, ArrowUp, Minus, Loader2 } from "lucide-react";

export interface FilterRow {
  filter: string;
  removed: number;
  remaining: number;
  percentRemaining: number;
  previousRemoved?: number;
  delta?: number;
  isLoading?: boolean;
}

const defaultFilterData: FilterRow[] = [
  { filter: "Credit Rating < BBB-", removed: 2000, remaining: 8000, percentRemaining: 80, previousRemoved: 2000, delta: 0 },
  { filter: "Russia Exposure", removed: 1500, remaining: 6500, percentRemaining: 65, previousRemoved: 1500, delta: 0 },
  { filter: "Sector Overweight (Financials)", removed: 1300, remaining: 5200, percentRemaining: 52, previousRemoved: 1300, delta: 0 },
  { filter: "ESG Exclusions (Tobacco, Weapons)", removed: 400, remaining: 4800, percentRemaining: 48, previousRemoved: 400, delta: 0 },
  { filter: "Liquidity Requirements", removed: 600, remaining: 4200, percentRemaining: 42, previousRemoved: 600, delta: 0 },
];

const comparisonData: FilterRow[] = [
  { filter: "Credit Rating < BBB", removed: 2500, remaining: 7500, percentRemaining: 75, previousRemoved: 2000, delta: 500 },
  { filter: "Russia Exposure", removed: 1500, remaining: 6000, percentRemaining: 60, previousRemoved: 1500, delta: 0 },
  { filter: "Sector Overweight (Financials)", removed: 1300, remaining: 4700, percentRemaining: 47, previousRemoved: 1300, delta: 0 },
  { filter: "ESG Exclusions (Tobacco, Weapons, Gambling)", removed: 600, remaining: 4100, percentRemaining: 41, previousRemoved: 400, delta: 200 },
  { filter: "Minimum Market Cap ($500M)", removed: 300, remaining: 3800, percentRemaining: 38, previousRemoved: 0, delta: 300 },
];

interface FilterBreakdownTableProps {
  isComparing?: boolean;
  data?: FilterRow[];
  isLoading?: boolean;
  currentLoadingIndex?: number;
}

export function FilterBreakdownTable({ 
  isComparing = false, 
  data,
  isLoading = false,
  currentLoadingIndex = -1
}: FilterBreakdownTableProps) {
  // Use provided data or fall back to defaults
  const tableData = data && data.length > 0 
    ? data 
    : (isComparing ? comparisonData : defaultFilterData);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Filter Applied</TableHead>
            <TableHead className="font-semibold text-right">Assets Removed</TableHead>
            <TableHead className="font-semibold text-right">Remaining</TableHead>
            {isComparing && (
              <TableHead className="font-semibold text-right">Delta</TableHead>
            )}
            <TableHead className="font-semibold w-32">Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableData.map((row, idx) => {
            const isCurrentlyLoading = isLoading && idx === currentLoadingIndex;
            const isPending = isLoading && idx > currentLoadingIndex && currentLoadingIndex >= 0;
            
            return (
              <TableRow 
                key={row.filter}
                className={`
                  ${isComparing && row.delta && row.delta > 0 ? "bg-destructive/5" : ""}
                  ${isCurrentlyLoading ? "bg-primary/5 animate-pulse" : ""}
                  ${isPending ? "opacity-40" : ""}
                `}
              >
                <TableCell className="font-medium">
                  {row.filter}
                  {isCurrentlyLoading && (
                    <Loader2 className="w-3.5 h-3.5 ml-2 inline animate-spin text-primary" />
                  )}
                </TableCell>
                <TableCell className="text-right text-destructive font-medium">
                  {isPending ? "—" : `−${row.removed.toLocaleString()}`}
                </TableCell>
                <TableCell className="text-right">
                  {isPending ? "—" : row.remaining.toLocaleString()}
                </TableCell>
                {isComparing && (
                  <TableCell className="text-right">
                    {isPending ? "—" : row.delta === 0 ? (
                      <span className="text-muted-foreground flex items-center justify-end gap-1">
                        <Minus className="w-3 h-3" /> —
                      </span>
                    ) : row.delta && row.delta > 0 ? (
                      <span className="text-destructive flex items-center justify-end gap-1">
                        <ArrowDown className="w-3 h-3" /> -{row.delta}
                      </span>
                    ) : (
                      <span className="text-success flex items-center justify-end gap-1">
                        <ArrowUp className="w-3 h-3" /> +{Math.abs(row.delta || 0)}
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <Progress 
                    value={isPending ? 100 : row.percentRemaining} 
                    className={`h-2 ${isPending ? "opacity-30" : ""}`} 
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
