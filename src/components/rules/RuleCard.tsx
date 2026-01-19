import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Code } from "lucide-react";
import { useState } from "react";

interface RuleCardProps {
  name: string;
  description: string;
  sql: string;
  status: "matched" | "missing" | "partial";
  pdfValue?: string;
  dbValue?: string;
}

export function RuleCard({ name, description, sql, status, pdfValue, dbValue }: RuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    matched: { label: "Matched", variant: "success" as const },
    missing: { label: "Config Missing", variant: "destructive" as const },
    partial: { label: "Partial Match", variant: "warning" as const },
  };

  const currentStatus = statusConfig[status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(pdfValue || dbValue) && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {pdfValue && (
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">PDF Value:</span>
                <p className="text-muted-foreground mt-0.5">{pdfValue}</p>
              </div>
            )}
            {dbValue && (
              <div className="p-2 bg-muted rounded">
                <span className="font-medium">DB Value:</span>
                <p className="text-muted-foreground mt-0.5">{dbValue}</p>
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            View SQL
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {isExpanded && (
          <pre className="p-3 bg-primary text-primary-foreground rounded-lg text-xs overflow-x-auto font-mono">
            {sql}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
