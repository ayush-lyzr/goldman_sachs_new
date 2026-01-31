"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { FunnelChart, FunnelStage } from "@/components/simulation/FunnelChart";
import { FilterBreakdownTable, FilterRow } from "@/components/simulation/FilterBreakdownTable";
import { UniverseComparisonChart } from "@/components/comparison/UniverseComparisonChart";
import { ComparisonToggle } from "@/components/comparison/ComparisonToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingDown, Target, Layers, GitCompare, ArrowDown, Loader2, RefreshCw, Database } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const STARTING_UNIVERSE = 10000;

interface ConstraintDelta {
  constraint: string;
  // Newer gap-analysis shape
  allowed_values?: string[];
  not_allowed_values?: string[];
  match_count?: string | null;
  // Backwards compatible shape (older gap-analysis)
  pdf_value?: string[];
  fidessa_value?: string[];
  delta: string | null;
  matched: boolean;
}

interface FilterResult {
  constraint: string;
  count: number;
  pdfValues: string[];
}

const steps = [
  { id: 1, name: "Upload", status: "completed" as const },
  { id: 2, name: "Extract", status: "completed" as const },
  { id: 3, name: "Generate Rules", status: "completed" as const },
  { id: 4, name: "Gap Analysis", status: "completed" as const },
  { id: 5, name: "Simulate", status: "current" as const },
];

const sampleSecurities = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", rating: "AA+" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", rating: "AAA" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", rating: "AAA" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", rating: "A+" },
  { ticker: "V", name: "Visa Inc.", sector: "Financials", rating: "AA-" },
];

// Hardcoded bond universe data
const bondUniverseData = [
  { id: 986476, bondId: "BND000001", name: "State of California Zero Coupon Bond due 2043", issuer: "State of California", countryRisk: "US", countryIssuer: "US", type: "Municipal", seniority: "Senior", currency: "USD" },
  { id: 681391, bondId: "BND000002", name: "International Bank for Reconstruction and Develop", issuer: "International Bank for Reconstruction and Develop", countryRisk: "XX", countryIssuer: "XX", type: "Supranational", seniority: "Senior", currency: "USD" },
  { id: 667210, bondId: "BND000003", name: "French Republic 3.58% Inflation-Linked Bond due", issuer: "French Republic", countryRisk: "FR", countryIssuer: "FR", type: "Sovereign", seniority: "Subordinated", currency: "EUR" },
  { id: 823727, bondId: "BND000004", name: "JPMorgan Chase & Co 7.36% Inflation-Linked Bon", issuer: "JPMorgan Chase & Co", countryRisk: "US", countryIssuer: "US", type: "Corporate", seniority: "Senior Subordinated", currency: "USD" },
  { id: 105548, bondId: "BND000005", name: "Emirates Islamic Bank PJSC Floating Rate Notes e", issuer: "Emirates Islamic Bank PJSC", countryRisk: "AE", countryIssuer: "AE", type: "Sukuk", seniority: "Subordinated", currency: "AED" },
  { id: 590908, bondId: "BND000006", name: "Citigroup Inc 11.59% Inflation-Linked Bond due 20", issuer: "Citigroup Inc", countryRisk: "US", countryIssuer: "US", type: "Corporate", seniority: "Subordinated", currency: "USD" },
  { id: 368324, bondId: "BND000007", name: "Manulife Financial Corporation 2.96% Inflation-Lin", issuer: "Manulife Financial Corporation", countryRisk: "CA", countryIssuer: "CA", type: "Corporate", seniority: "Subordinated", currency: "CAD" },
  { id: 16774, bondId: "BND000008", name: "Government of Malaysia 2.61% Inflation-Linked Br", issuer: "Government of Malaysia", countryRisk: "MY", countryIssuer: "MY", type: "Sukuk", seniority: "Senior", currency: "MYR" },
  { id: 12825, bondId: "BND000009", name: "Swiss Confederation 2.28% Inflation-Linked Bond", issuer: "Swiss Confederation", countryRisk: "CH", countryIssuer: "CH", type: "Sovereign", seniority: "Senior", currency: "CHF" },
  { id: 947887, bondId: "BND000010", name: "Severn Trent Utilities Finance plc 5.32% Subordina", issuer: "Severn Trent Utilities Finance plc", countryRisk: "GB", countryIssuer: "GB", type: "Corporate", seniority: "Subordinated", currency: "GBP" },
];

function SimulationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isComparing, setIsComparing] = useState(searchParams.get("compare") === "true");
  const [isOpen, setIsOpen] = useState(false);
  const [isUniverseOpen, setIsUniverseOpen] = useState(false);
  
  // SQL Agent state
  const [gapAnalysisData, setGapAnalysisData] = useState<ConstraintDelta[]>([]);
  const [filterResults, setFilterResults] = useState<FilterResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLoadingIndex, setCurrentLoadingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Prevent duplicate API calls
  const isProcessingRef = useRef(false);
  const hasStartedRef = useRef(false);

  // Load gap analysis data from sessionStorage
  useEffect(() => {
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
      setHasLoaded(true);
    }
  }, []);

  // Format constraints as natural language message
  const formatConstraintsMessage = (constraints: ConstraintDelta[]): string => {
    const parts = constraints.map((c) => {
      // Replace underscores with spaces in constraint names
      const constraintName = c.constraint.replace(/_/g, " ");
      const legacyPdf = c.pdf_value ?? [];
      const allowed = c.allowed_values ?? legacyPdf.filter(v => !v.trim().startsWith("!")).map(v => v.trim()).filter(Boolean);
      const notAllowed = c.not_allowed_values ?? legacyPdf.filter(v => v.trim().startsWith("!")).map(v => `!${v.trim().replace(/^!\s*/, "")}`).filter(Boolean);
      const values = [...allowed, ...notAllowed].join(", ");
      return `${constraintName} which has pdf_values as ${values}`;
    });
    
    return `give count for ${parts.join(" and ")}`;
  };

  // Call SQL agent for each constraint cumulatively
  const runSimulation = useCallback(async () => {
    if (gapAnalysisData.length === 0 || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);
    setError(null);
    setFilterResults([]);

    const sessionId = typeof window !== 'undefined' 
      ? sessionStorage.getItem("currentCustomerId") || "demo-customer"
      : "demo-customer";

    const results: FilterResult[] = [];
    const cumulativeConstraints: ConstraintDelta[] = [];

    try {
      for (let i = 0; i < gapAnalysisData.length; i++) {
        const constraint = gapAnalysisData[i];
        setCurrentLoadingIndex(i);

        // Add current constraint to cumulative list
        cumulativeConstraints.push(constraint);

        // Build the natural language message
        const message = formatConstraintsMessage(cumulativeConstraints);

        console.log(`Calling SQL agent for constraint ${i + 1}/${gapAnalysisData.length}: ${constraint.constraint}`);
        console.log(`Message: ${message}`);

        try {
          const response = await fetch("/api/agents/sql-filter", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerId: sessionId,
              message: message,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to get count for ${constraint.constraint}`);
          }

          const data = await response.json();
          const count = typeof data.count === 'number' ? data.count : parseInt(data.count, 10);

          results.push({
            constraint: constraint.constraint,
            count,
            pdfValues: constraint.pdf_value ?? [],
          });

          // Update results progressively
          setFilterResults([...results]);
        } catch (apiError) {
          console.error(`Error calling SQL agent for ${constraint.constraint}:`, apiError);
          // Continue with remaining constraints even if one fails
          results.push({
            constraint: constraint.constraint,
            count: results.length > 0 ? results[results.length - 1].count : STARTING_UNIVERSE,
            pdfValues: constraint.pdf_value ?? [],
          });
          setFilterResults([...results]);
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
      setError(err instanceof Error ? err.message : "Failed to run simulation");
    } finally {
      setIsLoading(false);
      setCurrentLoadingIndex(-1);
      isProcessingRef.current = false;
    }
  }, [gapAnalysisData]);

  // Auto-run simulation when gap analysis data is loaded
  useEffect(() => {
    if (hasLoaded && gapAnalysisData.length > 0 && !hasStartedRef.current && !isComparing) {
      hasStartedRef.current = true;
      runSimulation();
    }
  }, [hasLoaded, gapAnalysisData, runSimulation, isComparing]);

  // Helper to format constraint name (replace underscores with spaces)
  const formatConstraintName = (name: string): string => {
    return name.replace(/_/g, " ");
  };

  // Convert filter results to funnel data
  // Structure: Global Security Master -> Constraint 1 -> Constraint 2 -> ... -> Constraint N
  // The last constraint's count represents the final Tradable Universe
  const funnelData: FunnelStage[] = (() => {
    const stages: FunnelStage[] = [
      { name: "Global Security Master", count: STARTING_UNIVERSE, removed: 0, percentage: 100 },
    ];

    let previousCount = STARTING_UNIVERSE;

    filterResults.forEach((result) => {
      const removed = previousCount - result.count;
      const percentage = (result.count / STARTING_UNIVERSE) * 100;
      
      stages.push({
        name: formatConstraintName(result.constraint),
        count: result.count,
        removed: removed > 0 ? removed : 0,
        percentage,
      });
      
      previousCount = result.count;
    });

    return stages;
  })();

  // Convert filter results to table data
  const tableData: FilterRow[] = (() => {
    let previousCount = STARTING_UNIVERSE;
    
    return filterResults.map((result) => {
      const removed = previousCount - result.count;
      const percentRemaining = (result.count / STARTING_UNIVERSE) * 100;
      
      // Format: "Constraint Name (value1, value2, value3...)"
      const constraintName = formatConstraintName(result.constraint);
      const valuesPreview = result.pdfValues.slice(0, 3).join(", ");
      const hasMore = result.pdfValues.length > 3 ? "..." : "";
      
      const row: FilterRow = {
        filter: `${constraintName} (${valuesPreview}${hasMore})`,
        removed: removed > 0 ? removed : 0,
        remaining: result.count,
        percentRemaining,
      };
      
      previousCount = result.count;
      return row;
    });
  })();

  // Calculate stats
  const finalCount = filterResults.length > 0 
    ? filterResults[filterResults.length - 1].count 
    : (isLoading ? 0 : STARTING_UNIVERSE);
  const totalRemoved = STARTING_UNIVERSE - finalCount;
  const filterPercentage = Math.round((totalRemoved / STARTING_UNIVERSE) * 100);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tradable securities</h1>
              <p className="text-muted-foreground">
                {isComparing
                  ? "Compare universe impact from guideline changes"
                  : "Visualize how rules filter the tradable universe"
                }
              </p>
            </div>
            {!isComparing && gapAnalysisData.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  hasStartedRef.current = false;
                  isProcessingRef.current = false;
                  runSimulation();
                }}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ComparisonToggle isComparing={isComparing} onToggle={() => setIsComparing(!isComparing)} />
          </div>
        </div>

        <WorkflowStepper steps={steps} />

        {/* Error Banner */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="text-destructive">{error}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Banner */}
        {isLoading && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Running Simulation</p>
                  <p className="text-xs text-muted-foreground">
                    Processing constraint {currentLoadingIndex + 1} of {gapAnalysisData.length}: {gapAnalysisData[currentLoadingIndex]?.constraint || "..."}
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  {currentLoadingIndex + 1}/{gapAnalysisData.length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {isComparing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <GitCompare className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Universe Impact Analysis</p>
                  <p className="text-xs text-muted-foreground">
                    Showing how updated guidelines affect the tradable universe
                  </p>
                </div>
                <Badge variant="destructive" className="gap-1">
                  <ArrowDown className="w-3 h-3" /> 400 securities removed
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {isComparing ? (
            <UniverseComparisonChart />
          ) : (
            <FunnelChart 
              data={funnelData.length > 1 ? funnelData : undefined}
              isLoading={isLoading}
              currentLoadingIndex={currentLoadingIndex + 1} // +1 because first stage is GSM
            />
          )}

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isComparing ? "Impact by Filter" : "Filter Breakdown"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FilterBreakdownTable 
                  isComparing={isComparing} 
                  data={tableData.length > 0 ? tableData : undefined}
                  isLoading={isLoading}
                  currentLoadingIndex={currentLoadingIndex}
                />
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Bond Universe Collapsible Table */}
        {/* <Collapsible open={isUniverseOpen} onOpenChange={setIsUniverseOpen}>
          <Card className="overflow-hidden border-slate-200/60">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors">
                    <Database className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold text-foreground">
                      Post Filtering Database
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {bondUniverseData.length} securities in filtered database
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {isUniverseOpen ? "Hide" : "Show"} Details
                  </Badge>
                  <ChevronDown 
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                      isUniverseOpen ? "rotate-180" : ""
                    }`} 
                  />
                </div>
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="border-t border-slate-200/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Bond ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Issuer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Country Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Country Issuer</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Seniority</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Currency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 bg-white">
                      {bondUniverseData.map((bond, index) => (
                        <tr 
                          key={bond.id} 
                          className="hover:bg-slate-50/50 transition-colors"
                          style={{ 
                            animationDelay: `${index * 30}ms`,
                          }}
                        >
                          <td className="px-4 py-3 text-xs text-slate-600 font-mono">{bond.id}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs font-mono bg-blue-50/50 border-blue-200/50 text-blue-700">
                              {bond.bondId}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-900 max-w-xs truncate" title={bond.name}>
                            {bond.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 max-w-xs truncate" title={bond.issuer}>
                            {bond.issuer}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {bond.countryRisk}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {bond.countryIssuer}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                bond.type === "Sovereign" ? "bg-purple-50/50 border-purple-200/50 text-purple-700" :
                                bond.type === "Corporate" ? "bg-indigo-50/50 border-indigo-200/50 text-indigo-700" :
                                bond.type === "Supranational" ? "bg-cyan-50/50 border-cyan-200/50 text-cyan-700" :
                                bond.type === "Municipal" ? "bg-green-50/50 border-green-200/50 text-green-700" :
                                "bg-amber-50/50 border-amber-200/50 text-amber-700"
                              }`}
                            >
                              {bond.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                bond.seniority === "Senior" ? "bg-emerald-50/50 border-emerald-200/50 text-emerald-700" :
                                bond.seniority === "Senior Subordinated" ? "bg-yellow-50/50 border-yellow-200/50 text-yellow-700" :
                                "bg-orange-50/50 border-orange-200/50 text-orange-700"
                              }`}
                            >
                              {bond.seniority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary" className="text-xs font-mono font-bold">
                              {bond.currency}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible> */}

        {/* <div className="flex justify-end">
          <Button 
            // Exiting compare mode when continuing forward keeps report generation
            // consistent with the normal simulation run.
            onClick={() => router.push("/report")} 
            size="lg"
            disabled={isLoading}
          >
            Generate Report
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div> */}
      </div>
    </AppLayout>
  );
}

export default function SimulationPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="space-y-6">
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
                Preparing the simulation page...
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    }>
      <SimulationPageContent />
    </Suspense>
  );
}
