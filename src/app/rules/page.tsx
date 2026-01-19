"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { GapAnalysisTable } from "@/components/rules/GapAnalysisTable";
import { GapAnalysisDisplay } from "@/components/rules/GapAnalysisDisplay";
import { RulesComparisonTable } from "@/components/comparison/RulesComparisonTable";
import { ComparisonToggle } from "@/components/comparison/ComparisonToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  GitCompare, 
  Plus, 
  RefreshCw, 
  Loader2,
  Scale,
  Sparkles,
  TrendingUp,
  BarChart3
} from "lucide-react";

interface ConstraintDelta {
  constraint: string;
  pdf_value: string[];
  fidessa_value: string[];
  delta: string | null;
  matched: boolean;
}

const steps = [
  { id: 1, name: "Upload", status: "completed" as const },
  { id: 2, name: "Extract", status: "completed" as const },
  { id: 3, name: "Generate Rules", status: "current" as const },
  { id: 4, name: "Gap Analysis", status: "current" as const },
  { id: 5, name: "Simulate", status: "upcoming" as const },
];

function RulesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isComparing, setIsComparing] = useState(searchParams.get("compare") === "true");
  const [gapAnalysisData, setGapAnalysisData] = useState<ConstraintDelta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load gap analysis data from sessionStorage
    if (typeof window !== 'undefined') {
      const storedGapAnalysis = sessionStorage.getItem("gapAnalysis");
      
      if (storedGapAnalysis) {
        try {
          const data = JSON.parse(storedGapAnalysis);
          setGapAnalysisData(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Error parsing gap analysis data:", error);
          setGapAnalysisData([]);
        }
      }
      
      setLoading(false);
    }
  }, []);

  // Calculate stats from gap analysis data
  const matchedCount = gapAnalysisData.filter(r => r.matched).length;
  const unmatchedCount = gapAnalysisData.filter(r => !r.matched).length;
  const totalCount = gapAnalysisData.length;
  const matchRate = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-5 text-white animate-fade-up">
          {/* Background effects */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl" />
          
          <div className="relative flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Step 4 of 5
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-[10px] font-medium text-emerald-400">
                      Analysis Complete
                    </span>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight">
                    {isComparing ? "Rules Delta Analysis" : "Gap Analysis"}
                  </h1>
                </div>
              </div>
              
            </div>
            
            {/* Comparison toggle commented out - only available on constraints page */}
            {/* <ComparisonToggle isComparing={isComparing} onToggle={() => setIsComparing(!isComparing)} /> */}
          </div>
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper steps={steps} />

        {/* Comparison Mode Banner */}
        {isComparing && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent overflow-hidden animate-fade-up">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <GitCompare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Rules Delta Analysis Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Comparing rules generated from Q4 2024 vs Q1 2025 guidelines
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="gap-1 px-2.5 py-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                    <Plus className="w-3 h-3" /> 1 Added
                  </Badge>
                  <Badge className="gap-1 px-2.5 py-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
                    <RefreshCw className="w-3 h-3" /> 2 Modified
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {/* Section Header */}
          

          {/* Content Area */}
          {loading ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="relative mx-auto w-16 h-16 mb-6">
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Analyzing Constraints</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Running gap analysis between extracted rules and database values...
                </p>
              </CardContent>
            </Card>
          ) : isComparing ? (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <RulesComparisonTable />
              </CardContent>
            </Card>
          ) : gapAnalysisData.length > 0 ? (
            <GapAnalysisDisplay mappedRules={gapAnalysisData} />
          ) : (
            <GapAnalysisTable />
          )}

          {/* Summary Stats Grid */}
          <div className="grid sm:grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            {/* Matched Card */}
            <Card className="group relative overflow-hidden border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-500 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="pt-4 pb-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {isComparing ? "3" : (loading ? "—" : matchedCount)}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {isComparing ? "Unchanged Rules" : "Matched Constraints"}
                    </p>
                  </div>
                </div>
                {!loading && !isComparing && totalCount > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                          style={{ width: `${matchRate}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {matchRate}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gaps Card */}
            <Card className="group relative overflow-hidden border-amber-500/20 hover:border-amber-500/40 transition-all duration-500 hover:shadow-lg hover:shadow-amber-500/5">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="pt-4 pb-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
                    {isComparing ? (
                      <Plus className="w-5 h-5 text-amber-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className={`text-2xl font-bold tabular-nums ${unmatchedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                      {isComparing ? "1" : (loading ? "—" : unmatchedCount)}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {isComparing ? "New Rules" : "Gaps Identified"}
                    </p>
                  </div>
                </div>
                {!loading && !isComparing && unmatchedCount > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="font-medium">Requires attention</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total Card */}
            <Card className="group relative overflow-hidden border-primary/20 hover:border-primary/40 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="pt-4 pb-4 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                    {isComparing ? (
                      <RefreshCw className="w-5 h-5 text-primary" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {isComparing ? "2" : (loading ? "—" : totalCount)}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {isComparing ? "Modified Rules" : "Total Constraints"}
                    </p>
                  </div>
                </div>
                {!loading && !isComparing && totalCount > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="font-medium">Analysis complete</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end pt-4 border-t border-border/50">
            <Button 
              onClick={() => router.push(`/simulation${isComparing ? "?compare=true" : ""}`)} 
              size="default"
              className="gap-2 px-6 h-10 text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              <span>Continue to Simulation</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="space-y-5 max-w-[1400px] mx-auto">
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="relative mx-auto w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Loading...</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Preparing the rules page...
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    }>
      <RulesPageContent />
    </Suspense>
  );
}
