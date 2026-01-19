import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, RefreshCw, Equal } from "lucide-react";

interface RuleDelta {
  id: string;
  ruleName: string;
  previousValue?: string;
  newValue?: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
}

const rulesComparison: RuleDelta[] = [
  { 
    id: "1", 
    ruleName: "Credit Rating Minimum", 
    previousValue: "BBB-", 
    newValue: "BBB", 
    changeType: "modified" 
  },
  { 
    id: "2", 
    ruleName: "Single Issuer Limit", 
    previousValue: "5%", 
    newValue: "5%", 
    changeType: "unchanged" 
  },
  { 
    id: "3", 
    ruleName: "Russia Country Exclusion", 
    previousValue: "Active", 
    newValue: "Active", 
    changeType: "unchanged" 
  },
  { 
    id: "4", 
    ruleName: "ESG Exclusions", 
    previousValue: "Tobacco, Weapons", 
    newValue: "Tobacco, Weapons, Gambling", 
    changeType: "modified" 
  },
  { 
    id: "5", 
    ruleName: "Sector Limit (Financials)", 
    previousValue: "25%", 
    newValue: "25%", 
    changeType: "unchanged" 
  },
  { 
    id: "6", 
    ruleName: "Minimum Market Cap", 
    newValue: "$500M", 
    changeType: "added" 
  },
];

export function RulesComparisonTable() {
  const changeConfig = {
    added: { icon: Plus, label: "Added", variant: "success" as const },
    removed: { icon: Minus, label: "Removed", variant: "destructive" as const },
    modified: { icon: RefreshCw, label: "Modified", variant: "warning" as const },
    unchanged: { icon: Equal, label: "Unchanged", variant: "secondary" as const },
  };

  const addedCount = rulesComparison.filter(r => r.changeType === "added").length;
  const modifiedCount = rulesComparison.filter(r => r.changeType === "modified").length;
  const removedCount = rulesComparison.filter(r => r.changeType === "removed").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {addedCount > 0 && (
          <Badge variant="success" className="gap-1">
            <Plus className="w-3 h-3" /> {addedCount} Added
          </Badge>
        )}
        {modifiedCount > 0 && (
          <Badge variant="warning" className="gap-1">
            <RefreshCw className="w-3 h-3" /> {modifiedCount} Modified
          </Badge>
        )}
        {removedCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Minus className="w-3 h-3" /> {removedCount} Removed
          </Badge>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Previous</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rulesComparison.map((rule) => {
            const config = changeConfig[rule.changeType];
            const Icon = config.icon;

            return (
              <TableRow 
                key={rule.id}
                className={
                  rule.changeType === "added" ? "bg-success/5" :
                  rule.changeType === "removed" ? "bg-destructive/5" :
                  rule.changeType === "modified" ? "bg-warning/5" : ""
                }
              >
                <TableCell className="font-medium">{rule.ruleName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {rule.previousValue || "—"}
                </TableCell>
                <TableCell className={rule.changeType !== "unchanged" ? "font-medium" : ""}>
                  {rule.newValue || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={config.variant} className="gap-1">
                    <Icon className="w-3 h-3" />
                    {config.label}
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
