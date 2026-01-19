import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface FunnelStageComparison {
  name: string;
  previousCount: number;
  newCount: number;
  delta: number;
}

const comparisonData: FunnelStageComparison[] = [
  { name: "Global Security Master", previousCount: 10000, newCount: 10000, delta: 0 },
  { name: "Credit Rating Filter", previousCount: 8000, newCount: 7500, delta: -500 },
  { name: "Country Restrictions", previousCount: 6500, newCount: 6200, delta: -300 },
  { name: "Sector Limits", previousCount: 5200, newCount: 5000, delta: -200 },
  { name: "ESG Exclusions", previousCount: 4800, newCount: 4400, delta: -400 },
  { name: "Tradable Universe", previousCount: 4200, newCount: 3800, delta: -400 },
];

export function UniverseComparisonChart() {
  const totalDelta = comparisonData[comparisonData.length - 1].delta;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Universe Impact Comparison</CardTitle>
          <Badge variant={totalDelta < 0 ? "destructive" : totalDelta > 0 ? "success" : "secondary"}>
            {totalDelta > 0 ? "+" : ""}{totalDelta.toLocaleString()} securities
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {comparisonData.map((stage, idx) => {
            const previousWidth = (stage.previousCount / 10000) * 100;
            const newWidth = (stage.newCount / 10000) * 100;
            const isLast = idx === comparisonData.length - 1;

            return (
              <div key={stage.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{stage.previousCount.toLocaleString()}</span>
                    <span>→</span>
                    <span className={isLast ? "text-success font-bold" : "font-medium"}>
                      {stage.newCount.toLocaleString()}
                    </span>
                    {stage.delta !== 0 && (
                      <span className={`flex items-center gap-1 text-xs ${stage.delta < 0 ? "text-destructive" : "text-success"}`}>
                        {stage.delta < 0 ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                        {Math.abs(stage.delta)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-6 bg-muted/30 rounded overflow-hidden">
                  {/* Previous bar (faded) */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-primary/20 rounded transition-all"
                    style={{ width: `${previousWidth}%` }}
                  />
                  {/* New bar */}
                  <div 
                    className={`absolute inset-y-0 left-0 rounded transition-all ${isLast ? "bg-success" : "bg-primary"}`}
                    style={{ width: `${newWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-muted-foreground">4,200</p>
              <p className="text-xs text-muted-foreground">Previous Universe</p>
            </div>
            <div>
              <p className="text-lg font-bold text-destructive">-400</p>
              <p className="text-xs text-muted-foreground">Net Change</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">3,800</p>
              <p className="text-xs text-muted-foreground">New Universe</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
