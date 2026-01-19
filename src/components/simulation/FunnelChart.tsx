import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export interface FunnelStage {
  name: string;
  count: number;
  removed: number;
  percentage: number;
  isLoading?: boolean;
}

interface FunnelChartProps {
  data?: FunnelStage[];
  isLoading?: boolean;
  currentLoadingIndex?: number;
}

const defaultFunnelData: FunnelStage[] = [
  { name: "Global Security Master", count: 10000, removed: 0, percentage: 100 },
  { name: "Credit Rating Filter", count: 8000, removed: 2000, percentage: 80 },
  { name: "Country Restrictions", count: 6500, removed: 1500, percentage: 65 },
  { name: "Sector Limits", count: 5200, removed: 1300, percentage: 52 },
  { name: "ESG Exclusions", count: 4800, removed: 400, percentage: 48 },
  { name: "Tradable Universe", count: 4200, removed: 600, percentage: 42 },
];

export function FunnelChart({ data, isLoading = false, currentLoadingIndex = -1 }: FunnelChartProps) {
  const funnelData = data && data.length > 0 ? data : defaultFunnelData;
  
  // Calculate summary stats
  const startingCount = funnelData[0]?.count || 10000;
  const finalCount = funnelData[funnelData.length - 1]?.count || 0;
  const totalRemoved = startingCount - finalCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Universe Filtering Funnel
          {isLoading && (
            <span className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing constraints...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {funnelData.map((stage, idx) => {
            const isCurrentlyLoading = isLoading && idx === currentLoadingIndex;
            const isPending = isLoading && idx > currentLoadingIndex && currentLoadingIndex >= 0;
            const isComplete = !isLoading || idx < currentLoadingIndex || currentLoadingIndex === -1;
            const isLast = idx === funnelData.length - 1;
            
            return (
              <div key={stage.name} className="relative">
                <div
                  className={`h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-500 ${
                    isCurrentlyLoading ? "animate-pulse" : ""
                  } ${isPending ? "opacity-40" : ""}`}
                  style={{
                    width: isPending ? "100%" : `${stage.percentage}%`,
                    backgroundColor: isLast && isComplete
                      ? "hsl(var(--success))" 
                      : isCurrentlyLoading
                        ? "hsl(var(--primary) / 0.6)"
                        : `hsl(var(--primary) / ${0.2 + (idx * 0.15)})`,
                  }}
                >
                  <span className={`text-sm font-medium ${isLast && isComplete ? "text-success-foreground" : "text-foreground"}`}>
                    {stage.name}
                    {isCurrentlyLoading && (
                      <Loader2 className="w-3.5 h-3.5 ml-2 inline animate-spin" />
                    )}
                  </span>
                  <span className={`text-sm font-bold ${isLast && isComplete ? "text-success-foreground" : "text-foreground"}`}>
                    {isPending ? "—" : stage.count.toLocaleString()}
                  </span>
                </div>
                {stage.removed > 0 && !isPending && (
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 text-xs text-destructive whitespace-nowrap">
                    -{stage.removed.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {startingCount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">BaseLine</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">
                {isLoading && currentLoadingIndex >= 0 ? "..." : `-${totalRemoved.toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground">Filtered Out</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">
                {isLoading && currentLoadingIndex >= 0 ? "..." : finalCount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Tradable</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
