"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { GapAnalysisTable } from "@/components/rules/GapAnalysisTable";
import { GapAnalysisDisplay } from "@/components/rules/GapAnalysisDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowRight, 
  Loader2,
  Scale,
} from "lucide-react";

interface ConstraintDelta {
  constraint: string;
  pdf_value: string[];
  rules: string[];
  fidessa_value: string[];
  delta: string | null;
  matched: boolean;
}

const steps = [
  { id: 1, name: "Upload", status: "completed" as const },
  { id: 2, name: "Extract", status: "completed" as const },
  { id: 3, name: "Generate Rules", status: "current" as const },
  { id: 4, name: "Gap Analysis", status: "current" as const },
  // { id: 5, name: "Simulate", status: "upcoming" as const },
];

function RulesPageContent() {
  const router = useRouter();
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
                    Gap Analysis
                  </h1>
                </div>
              </div>
              
            </div>
          </div>
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper steps={steps} />

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
          ) : gapAnalysisData.length > 0 ? (
            <GapAnalysisDisplay mappedRules={gapAnalysisData} />
          ) : (
            <GapAnalysisTable />
          )}

          {/* Action Footer */}
          {/* <div className="flex justify-end pt-4 border-t border-border/50">
            <Button 
              onClick={() => router.push("/simulation")} 
              size="default"
              className="gap-2 px-6 h-10 text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              <span>Continue to Simulation</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div> */}
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
