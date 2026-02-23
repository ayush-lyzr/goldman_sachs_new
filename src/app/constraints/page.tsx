"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { ConstraintCard } from "@/components/constraints/ConstraintCard";
import { RulesVersionTable } from "@/components/comparison/RulesVersionTable";
import { ExtractedRulesDisplay } from "@/components/constraints/ExtractedRulesDisplay";
import { MarkdownDisplay } from "@/components/constraints/MarkdownDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  FileText,
  CheckCircle,
  GitCompare,
  Loader2,
  FileSearch,
  Sparkles,
  Layers,
  Zap,
  BookOpen,
  Clock,
  AlertCircle,
} from "lucide-react";
import { getCustomerById, getCatalogForVersion } from "@/lib/customers";

interface ExtractedRule {
  title: string;
  rules: string[];
}

type ChangeTag = "unchanged" | "modified" | "added" | "removed";

interface ConstraintChangeLine {
  tag: Exclude<ChangeTag, "modified">;
  text: string;
}

interface VersionComparison {
  from: string;
  to: string;
  changes_by_constraint: Array<{
    constraint_title: string;
    status: ChangeTag;
    changes: ConstraintChangeLine[];
  }>;
}

interface VersionInfo {
  version: number;
  versionName: string;
  createdAt: string;
}

interface MultiVersionDiffData {
  versions: VersionInfo[];
  comparisons: VersionComparison[];
}

const steps = [
  { id: 1, name: "Upload", status: "completed" as const },
  { id: 2, name: "Extract", status: "current" as const },
  { id: 3, name: "Generate Rules", status: "upcoming" as const },
  { id: 4, name: "Gap Analysis", status: "upcoming" as const },
  // { id: 5, name: "Simulate", status: "upcoming" as const },
];

const constraints = [
  {
    id: "1",
    clauseText: "Portfolio must maintain predominantly investment grade securities",
    sourcePage: 4,
    confidence: 78,
    isAmbiguous: true,
    interpretations: [
      { id: "conservative", label: "Conservative (≥80%)", description: "At least 80% of holdings must be BBB- or higher rated" },
      { id: "moderate", label: "Moderate (≥65%)", description: "At least 65% of holdings must be BBB- or higher rated" },
      { id: "liberal", label: "Liberal (≥51%)", description: "Simple majority must be BBB- or higher rated" },
    ],
  },
  {
    id: "2",
    clauseText: "Maximum single issuer exposure of 5% of portfolio NAV",
    sourcePage: 5,
    confidence: 95,
    isAmbiguous: false,
  },
  {
    id: "3",
    clauseText: "No investments permitted in Russian Federation domiciled entities",
    sourcePage: 7,
    confidence: 98,
    isAmbiguous: false,
  },
  {
    id: "4",
    clauseText: "Tobacco and controversial weapons manufacturers excluded",
    sourcePage: 8,
    confidence: 92,
    isAmbiguous: false,
  },
  {
    id: "5",
    clauseText: "Financial sector allocation should not exceed reasonable limits",
    sourcePage: 6,
    confidence: 65,
    isAmbiguous: true,
    interpretations: [
      { id: "strict", label: "Strict (≤20%)", description: "Maximum 20% allocation to financial sector" },
      { id: "standard", label: "Standard (≤25%)", description: "Maximum 25% allocation to financial sector" },
      { id: "flexible", label: "Flexible (≤30%)", description: "Maximum 30% allocation to financial sector" },
    ],
  },
];

// Delta data for comparison mode (demo fallback)
const constraintDeltas = [
  {
    id: "1",
    clauseText: "Portfolio must maintain investment grade securities with minimum BBB rating",
    previousText: "Portfolio must maintain predominantly investment grade securities",
    changeType: "modified" as const,
    confidence: 92,
    previousConfidence: 78,
  },
  {
    id: "2",
    clauseText: "Maximum single issuer exposure of 5% of portfolio NAV",
    changeType: "unchanged" as const,
    confidence: 95,
  },
  {
    id: "3",
    clauseText: "No investments permitted in Russian Federation domiciled entities",
    changeType: "unchanged" as const,
    confidence: 98,
  },
  {
    id: "4",
    clauseText: "Tobacco, gambling, and controversial weapons manufacturers excluded",
    previousText: "Tobacco and controversial weapons manufacturers excluded",
    changeType: "modified" as const,
    confidence: 94,
    previousConfidence: 92,
  },
  {
    id: "5",
    clauseText: "Financial sector allocation should not exceed 25%",
    previousText: "Financial sector allocation should not exceed reasonable limits",
    changeType: "modified" as const,
    confidence: 96,
    previousConfidence: 65,
  },
  {
    id: "6",
    clauseText: "Minimum market capitalization of $500 million for all equity positions",
    changeType: "added" as const,
    confidence: 98,
  },
];

function ConstraintsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [extractedRules, setExtractedRules] = useState<ExtractedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [extractedMarkdown, setExtractedMarkdown] = useState<string>("");
  const [comparingRules, setComparingRules] = useState(false);
  const [multiVersionDiff, setMultiVersionDiff] = useState<MultiVersionDiffData | null>(null);
  const [showCompareView, setShowCompareView] = useState(false);
  const [hasExistingVersions, setHasExistingVersions] = useState(false);
  const [checkingVersions, setCheckingVersions] = useState(true);
  const [comparisonStats, setComparisonStats] = useState<{ total: number; modified: number; added: number; removed: number } | null>(null);

  useEffect(() => {
    // Load extracted rules from sessionStorage and check for existing versions
    const loadData = async () => {
      if (typeof window !== 'undefined') {
        const storedRules = sessionStorage.getItem("extractedRules");
        const storedPDF = sessionStorage.getItem("extractedPDF");
        
        let parsedRules: ExtractedRule[] = [];
        
        if (storedRules) {
          try {
            const parsed: unknown = JSON.parse(storedRules);
            const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
            const extractRulesArray = (v: unknown): ExtractedRule[] => {
              if (Array.isArray(v)) return v as ExtractedRule[];
              if (isRecord(v) && Array.isArray(v.rules)) return v.rules as ExtractedRule[];
              return [];
            };
            parsedRules = extractRulesArray(parsed);
            setExtractedRules(parsedRules);
          } catch (error) {
            console.error("Error parsing extracted rules:", error);
            setExtractedRules([]);
          }
        }
        
        if (storedPDF) {
          try {
            const pdf = JSON.parse(storedPDF);
            setPdfFilename(pdf.filename || "Document");
            setExtractedMarkdown(pdf.markdown || "");
          } catch (error) {
            console.error("Error parsing PDF data:", error);
          }
        }

        // Check if there are existing versions in the database
        const customerId = sessionStorage.getItem("currentCustomerId");
        const projectId = sessionStorage.getItem("currentProjectId");
        let hasVersions = false;

        if (customerId) {
          try {
            const response = await fetch(`/api/projects/rulesets?customerId=${customerId}`, {
              cache: "no-store",
            });
            if (response.ok) {
              const data = await response.json();
              // Show comparison if there's at least 1 existing version
              hasVersions = data.rulesets && data.rulesets.length > 0;
              setHasExistingVersions(hasVersions);
              
              // Removed automatic comparison - users can compare files in history component
            }
          } catch (error) {
            console.error("Error checking for existing versions:", error);
          }
        }

        setLoading(false);
        setCheckingVersions(false);
      }
    };

    loadData();
  }, []);


  const handleGenerateRules = async () => {

    if (extractedRules.length === 0) {
      alert("No extracted rules available. Please upload and extract a document first.");
      return;
    }

    setGenerating(true);
    try {
      // Get customerId and projectId from sessionStorage
      let customerId = "";
      let projectId = "";
      
      if (typeof window !== 'undefined') {
        customerId = sessionStorage.getItem("currentCustomerId") || "";
        projectId = sessionStorage.getItem("currentProjectId") || "";
        
        if (!customerId || !projectId) {
          throw new Error("Missing customer or project ID. Please start from the upload step.");
        }
      }

      // Step 1: Call rules-to-column agent with the extracted rules
      setProcessingStep("Generating rules mapping...");
      console.log("Step 1: Calling rules-to-column agent...");
      const rulesToColumnResponse = await fetch("/api/agents/rules-to-column", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        cache: "no-store",
        body: JSON.stringify({
          projectId: projectId,
          customerId: customerId,
          rulesExtractorResponse: { rules: extractedRules },
        }),
      });

      if (!rulesToColumnResponse.ok) {
        const errorData = await rulesToColumnResponse.json();
        throw new Error(errorData.error || "Failed to generate rules");
      }

      const rulesToColumnData = await rulesToColumnResponse.json();
      console.log("Rules-to-column successful:", rulesToColumnData);

      // Check for errors in the response
      if (rulesToColumnData.error) {
        throw new Error(`Rules generation failed: ${rulesToColumnData.error}`);
      }

      // Step 2: Call gap analysis agent with the rules-to-column response
      setProcessingStep("Performing gap analysis...");
      console.log("Step 2: Calling gap analysis agent...");
      
      // Get fidessa_catalog from client list by companyId + selected version (no stored catalogs)
      let fidessa_catalog: Record<string, string> | undefined;
      if (typeof window !== "undefined") {
        const storedCompany = sessionStorage.getItem("currentSelectedCompany");
        const rulesVersion = (sessionStorage.getItem("currentRulesVersion") || "v1") as "v1" | "v2";
        if (storedCompany) {
          try {
            const parsed = JSON.parse(storedCompany) as { companyId?: string };
            const companyId = parsed?.companyId;
            const customer = companyId ? getCustomerById(companyId) : null;
            if (customer) {
              const catalog = getCatalogForVersion(customer, rulesVersion);
              fidessa_catalog = catalog as unknown as Record<string, string>;
              console.log("Using customer fidessa_catalog (" + rulesVersion + "):", fidessa_catalog);
            }
          } catch (err) {
            console.error("Error resolving client catalog:", err);
          }
        }
      }
      
      const gapAnalysisResponse = await fetch("/api/agents/gap-analysis", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        cache: "no-store",
        body: JSON.stringify({
          projectId: projectId,
          customerId: customerId,
          rulesToColumnResponse: rulesToColumnData,
          ...(fidessa_catalog && { fidessa_catalog }),
        }),
      });

      if (!gapAnalysisResponse.ok) {
        const errorData = await gapAnalysisResponse.json();
        throw new Error(errorData.error || "Failed to perform gap analysis");
      }

      const gapAnalysisData = await gapAnalysisResponse.json();
      console.log("Gap analysis successful:", gapAnalysisData);

      // Check for errors in the response
      if (gapAnalysisData.error) {
        throw new Error(`Gap analysis failed: ${gapAnalysisData.error}`);
      }

      // Store both results for the next page
      if (typeof window !== 'undefined') {
        sessionStorage.setItem("mappedRules", JSON.stringify(rulesToColumnData.mapped_rules || []));
        sessionStorage.setItem("gapAnalysis", JSON.stringify(gapAnalysisData.mapped_rules || []));
      }

      // Navigate to rules page
      router.push("/rules");
    } catch (error) {
      console.error("Error in rule generation flow:", error);
      alert(error instanceof Error ? error.message : "Failed to generate rules. Please try again.");
    } finally {
      setGenerating(false);
      setProcessingStep("");
    }
  };
  
  const isComparing = showCompareView && multiVersionDiff !== null;

  // Calculate stats from extracted rules
  const totalRules = extractedRules.reduce((acc, section) => acc + section.rules.length, 0);
  const totalSections = extractedRules.length;

  return (
    <AppLayout>
      <div className="space-y-3 max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 text-white animate-fade-up">
          {/* Background effects */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-violet-500/15 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                    <FileSearch className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                        Step 2 of 5
                      </span>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-[10px] font-medium text-cyan-400">
                        {loading ? "Processing..." : "Extraction Complete"}
                      </span>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">
                      {isComparing ? "Compare Guidelines" : "Constraint Extraction"}
                    </h1>
                  </div>
                </div>
                
              </div>
              {multiVersionDiff !== null && !comparingRules && (
                <div className="flex items-center gap-3 shrink-0">
                  <Label htmlFor="compare-switch" className="text-sm font-medium text-white/90 cursor-pointer">
                    Compare
                  </Label>
                  <Switch
                    id="compare-switch"
                    checked={showCompareView}
                    onCheckedChange={setShowCompareView}
                    className="data-[state=checked]:bg-cyan-500"
                  />
                </div>
              )}
            </div>

            {/* Comparison Stats - shown inline when comparing */}
            {isComparing && comparisonStats && (
              <div className="flex items-center gap-4 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Total Changes</span>
                  <span className="text-2xl font-bold text-white">{comparisonStats.total}</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Modified</span>
                  <span className="text-2xl font-bold text-amber-400">{comparisonStats.modified}</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Added</span>
                  <span className="text-2xl font-bold text-emerald-400">{comparisonStats.added}</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Removed</span>
                  <span className="text-2xl font-bold text-rose-400">{comparisonStats.removed}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper steps={steps} />

        {/* Main Content Grid: full width when comparing, otherwise main + sidebar */}
        <div className={isComparing ? "space-y-4" : "grid lg:grid-cols-4 gap-4"}>
          {/* Main Content Area */}
          <div className={isComparing ? "w-full space-y-4" : "lg:col-span-3 space-y-4"}>
            {loading ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <div className="relative mx-auto w-14 h-14 mb-5">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/10">
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Processing Document</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Extracting investment constraints from your guidelines document...
                  </p>
                </CardContent>
              </Card>
            ) : isComparing && multiVersionDiff ? (
              <div className="space-y-3">
                {comparingRules ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <div className="relative mx-auto w-14 h-14 mb-5">
                        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/10">
                          <Loader2 className="w-7 h-7 animate-spin text-primary" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Comparing Versions</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Analyzing differences across all versions...
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <RulesVersionTable 
                    data={multiVersionDiff} 
                    onStatsCalculated={setComparisonStats}
                  />
                )}
              </div>
            ) : extractedRules.length > 0 ? (
              <>
                <ExtractedRulesDisplay rules={extractedRules} />
                {extractedMarkdown && (
                  <MarkdownDisplay markdown={extractedMarkdown} filename={pdfFilename} />
                )}
              </>
            ) : (
              <div className="space-y-3">
                {extractedMarkdown && (
                  <MarkdownDisplay markdown={extractedMarkdown} filename={pdfFilename} />
                )}
                {constraints.map((constraint, index) => (
                  <div 
                    key={constraint.id}
                    className="animate-fade-up opacity-0"
                    style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
                  >
                    <ConstraintCard {...constraint} />
                  </div>
                ))}
              </div>
            )}

            {/* Processing Status & Action */}
            <div className="space-y-3 pt-3">
              {generating && processingStep && (
                <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                        <div className="relative p-2 rounded-full bg-primary/10">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{processingStep}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">This may take a moment...</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Processing</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleGenerateRules} 
                  size="default"
                  disabled={loading || generating || (!isComparing && extractedRules.length === 0)}
                  className="gap-2 px-6 h-10 text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Generate Rules & Analyze</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar - hidden in compare mode so sheet is full width */}
          {!isComparing && (
          <div className="space-y-3">
            {/* Document Info Card */}
            <Card className="overflow-hidden animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  {isComparing ? "Document Comparison" : "Source Document"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {isComparing ? "Investment_Guidelines_Q1_2025.pdf" : (pdfFilename || "Investment_Guidelines_Q4_2024.pdf")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {loading ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" />
                          Processed
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="pt-2.5 border-t border-border/50 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Sections Found</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {loading ? "..." : (totalSections > 0 ? totalSections : "5")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Rules</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {loading ? "..." : (totalRules > 0 ? totalRules : "—")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Avg per Section</span>
                    <span className="font-bold text-primary tabular-nums">
                      {loading ? "..." : (totalSections > 0 ? (totalRules / totalSections).toFixed(1) : "—")}
                    </span>
                  </div>
                  {isComparing && multiVersionDiff && (
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Versions</span>
                      <span className="font-bold text-primary tabular-nums">
                        {multiVersionDiff.versions.length}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agent Status Card */}
            <Card className="overflow-hidden animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Agent Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${loading ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-semibold ${loading ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {loading ? "Processing..." : (isComparing ? "Multi-Version Comparison Complete" : "Extraction Complete")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {isComparing
                        ? "All versions compared. Review the table below to see changes across versions."
                        : loading
                          ? "The extraction agent is processing your document..."
                          : "Constraint Extraction Agent processed the document successfully. Review before proceeding."
                      }
                    </p>
                  </div>
                </div>

                {/* Tip */}
                {!loading && !isComparing && extractedRules.length === 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>No extracted rules found. Using demo constraints for preview.</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Tip Card */}
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Pro Tip</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {isComparing
                        ? "The latest version is shown on the left. Scroll horizontally to see older versions."
                        : "Hover over constraint cards to see additional details."
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function ConstraintsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="space-y-3 max-w-[1400px] mx-auto">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="relative mx-auto w-14 h-14 mb-5">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/10">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Loading...</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Preparing the constraints page...
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    }>
      <ConstraintsPageContent />
    </Suspense>
  );
}
