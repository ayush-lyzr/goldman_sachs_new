"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { ConstraintCard } from "@/components/constraints/ConstraintCard";
import { ConstraintComparisonCard } from "@/components/comparison/ConstraintComparisonCard";
import { ComparisonToggle } from "@/components/comparison/ComparisonToggle";
import { ExtractedRulesDisplay } from "@/components/constraints/ExtractedRulesDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle
} from "lucide-react";

interface ExtractedRule {
  title: string;
  rules: string[];
}

interface RuleDiff {
  status: "UNCHANGED" | "MODIFIED" | "NEW" | "REMOVED";
  previous: string | null;
  current: string | null;
}

interface ConstraintDelta {
  id: string;
  clauseText: string;
  previousText?: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  confidence: number;
  previousConfidence?: number;
}

const steps = [
  { id: 1, name: "Upload", status: "completed" as const },
  { id: 2, name: "Extract", status: "current" as const },
  { id: 3, name: "Generate Rules", status: "upcoming" as const },
  { id: 4, name: "Gap Analysis", status: "upcoming" as const },
  { id: 5, name: "Simulate", status: "upcoming" as const },
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
  const [isComparing, setIsComparing] = useState(searchParams.get("compare") === "true");
  const [extractedRules, setExtractedRules] = useState<ExtractedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [comparingRules, setComparingRules] = useState(false);
  const [rulesDiff, setRulesDiff] = useState<{ rules: RuleDiff[] } | null>(null);
  const [hasExistingVersions, setHasExistingVersions] = useState(false);
  const [checkingVersions, setCheckingVersions] = useState(true);

  useEffect(() => {
    // Load extracted rules from sessionStorage and check for existing versions
    const loadData = async () => {
      if (typeof window !== 'undefined') {
        const storedRules = sessionStorage.getItem("extractedRules");
        const storedPDF = sessionStorage.getItem("extractedPDF");
        
        let parsedRules: ExtractedRule[] = [];
        
        if (storedRules) {
          try {
            const rules = JSON.parse(storedRules);
            parsedRules = Array.isArray(rules) ? rules : [];
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
            const response = await fetch(`/api/projects/rulesets?customerId=${customerId}`);
            if (response.ok) {
              const data = await response.json();
              // Show toggle if there's at least 1 existing version
              hasVersions = data.rulesets && data.rulesets.length > 0;
              setHasExistingVersions(hasVersions);

              // Auto-trigger comparison if there are existing versions and we have extracted rules
              if (hasVersions && parsedRules.length > 0 && customerId && projectId) {
                console.log("[constraints] Auto-triggering comparison mode for version update");
                setComparingRules(true);

                try {
                  // Get the latest version
                  const latestVersion = data.rulesets[data.rulesets.length - 1].version;

                  // Fetch the full data for the latest version
                  const versionResponse = await fetch(`/api/projects/rulesets/${latestVersion}?customerId=${customerId}`);

                  if (versionResponse.ok) {
                    const versionData = await versionResponse.json();
                    const latestRawRules = versionData.ruleset.data.raw_rules || [];

                    if (latestRawRules.length > 0) {
                      // Call the rules diff API
                      const diffResponse = await fetch("/api/agents/rules-diff", {
                        method: "POST",
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          projectId: projectId,
                          customerId: customerId,
                          rulesExtractorResponse: parsedRules,
                          latestRulesFromDB: latestRawRules,
                        }),
                      });

                      if (diffResponse.ok) {
                        const diffData = await diffResponse.json();
                        console.log("[constraints] Auto-comparison complete:", diffData);
                        setRulesDiff(diffData);
                        setIsComparing(true);
                      }
                    }
                  }
                } catch (compareError) {
                  console.error("[constraints] Auto-comparison failed:", compareError);
                  // Don't show error to user, just disable comparison mode
                } finally {
                  setComparingRules(false);
                }
              }
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

  const handleCompareToggle = async () => {
    if (!isComparing) {
      // Turning comparison mode ON - fetch and compare
      await fetchAndCompareRules();
    } else {
      // Turning comparison mode OFF - just toggle
      setIsComparing(false);
      setRulesDiff(null);
    }
  };

  const fetchAndCompareRules = async () => {
    if (extractedRules.length === 0) {
      alert("No extracted rules available for comparison. Please extract rules first.");
      return;
    }

    setComparingRules(true);
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

      // Step 1: Fetch all rulesets to get the latest version
      const rulesetsResponse = await fetch(`/api/projects/rulesets?customerId=${customerId}`);

      if (!rulesetsResponse.ok) {
        throw new Error("Failed to fetch project versions");
      }

      const rulesetsData = await rulesetsResponse.json();

      if (!rulesetsData.rulesets || rulesetsData.rulesets.length === 0) {
        alert("No previous versions found. Cannot compare without a baseline version.");
        return;
      }

      // Get the latest version number
      const latestVersion = rulesetsData.rulesets[rulesetsData.rulesets.length - 1].version;

      // Step 2: Fetch the full data for the latest version
      const versionResponse = await fetch(`/api/projects/rulesets/${latestVersion}?customerId=${customerId}`);

      if (!versionResponse.ok) {
        throw new Error("Failed to fetch latest version data");
      }

      const versionData = await versionResponse.json();
      const latestRawRules = versionData.ruleset.data.raw_rules || [];

      if (latestRawRules.length === 0) {
        alert("Latest version has no raw rules to compare against.");
        return;
      }

      // Step 3: Call the rules diff API
      const diffResponse = await fetch("/api/agents/rules-diff", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          customerId: customerId,
          rulesExtractorResponse: extractedRules,
          latestRulesFromDB: latestRawRules,
        }),
      });

      if (!diffResponse.ok) {
        const errorData = await diffResponse.json();
        throw new Error(errorData.error || "Failed to compare rules");
      }

      const diffData = await diffResponse.json();
      console.log("Rules diff result:", diffData);

      // Store the diff data and enable comparison mode
      setRulesDiff(diffData);
      setIsComparing(true);
    } catch (error) {
      console.error("Error comparing rules:", error);
      alert(error instanceof Error ? error.message : "Failed to compare rules. Please try again.");
    } finally {
      setComparingRules(false);
    }
  };

  const handleGenerateRules = async () => {
    // Even if the user was comparing versions, the forward flow should run the
    // real pipeline (rules → gap analysis) and then continue normally.
    // Comparison mode is meant for review, not to replace downstream steps.
    if (isComparing) {
      setIsComparing(false);
      setRulesDiff(null);
    }

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
      const gapAnalysisResponse = await fetch("/api/agents/gap-analysis", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          customerId: customerId,
          rulesToColumnResponse: rulesToColumnData,
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
  
  // Transform API diff response to UI format
  const transformedDiff: ConstraintDelta[] = rulesDiff?.rules ? rulesDiff.rules.map((rule: RuleDiff, index: number) => {
    const changeTypeMap: Record<string, "added" | "removed" | "modified" | "unchanged"> = {
      "NEW": "added",
      "REMOVED": "removed",
      "MODIFIED": "modified",
      "UNCHANGED": "unchanged"
    };

    return {
      id: `rule-${index + 1}`,
      clauseText: rule.current || rule.previous || "N/A",
      previousText: rule.previous || undefined,
      changeType: changeTypeMap[rule.status] || "unchanged",
      confidence: 95, // Default confidence since API doesn't provide it
      previousConfidence: rule.status === "MODIFIED" ? 90 : undefined,
    };
  }) : [];

  // Use transformed diff data if available, otherwise use demo data
  const displayedDeltas: ConstraintDelta[] = isComparing && rulesDiff ? transformedDiff : constraintDeltas;

  const addedCount = displayedDeltas.filter((c: ConstraintDelta) => c.changeType === "added").length;
  const modifiedCount = displayedDeltas.filter((c: ConstraintDelta) => c.changeType === "modified").length;

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
          
          <div className="relative flex items-start justify-between">
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

            {hasExistingVersions && !checkingVersions && (
              <ComparisonToggle 
                isComparing={isComparing} 
                onToggle={handleCompareToggle}
                isLoading={comparingRules}
              />
            )}
          </div>
        </div>

        {/* Workflow Stepper */}
        <WorkflowStepper steps={steps} />

        {/* Comparison Mode Banner */}
        {isComparing && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent overflow-hidden animate-fade-up">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <GitCompare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {rulesDiff ? "Version Comparison Complete" : "Comparing Guidelines"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {rulesDiff ? (
                      <>
                        <span className="font-mono text-[10px]">Latest Version</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="font-mono text-[10px]">Current Extraction</span>
                        <CheckCircle className="w-3 h-3 text-emerald-500 ml-1" />
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-[10px]">Investment_Guidelines_Q4_2024.pdf</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="font-mono text-[10px]">Investment_Guidelines_Q1_2025.pdf</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {addedCount > 0 && (
                    <Badge className="gap-1 px-2.5 py-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      {addedCount} Added
                    </Badge>
                  )}
                  {modifiedCount > 0 && (
                    <Badge className="gap-1 px-2.5 py-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      {modifiedCount} Modified
                    </Badge>
                  )}
                  {addedCount === 0 && modifiedCount === 0 && (
                    <Badge className="gap-1 px-2.5 py-1 text-[10px] bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30">
                      No Changes
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-4 gap-4">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4">
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
            ) : isComparing ? (
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
                        Analyzing differences between current and previous rules...
                      </p>
                    </CardContent>
                  </Card>
                ) : displayedDeltas.length > 0 ? (
                  displayedDeltas.map((constraint: ConstraintDelta, index: number) => (
                    <div 
                      key={constraint.id}
                      className="animate-fade-up opacity-0"
                      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
                    >
                      <ConstraintComparisonCard constraint={constraint} />
                    </div>
                  ))
                ) : (
                  <Card className="border-warning/50">
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="w-12 h-12 mx-auto text-warning mb-4" />
                      <p className="text-sm text-muted-foreground">No comparison data available</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : extractedRules.length > 0 ? (
              <ExtractedRulesDisplay rules={extractedRules} />
            ) : (
              <div className="space-y-3">
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

          {/* Sidebar */}
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
                  {isComparing ? (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">New Constraints</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{addedCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Modified</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">{modifiedCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Unchanged</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {displayedDeltas.filter((c: ConstraintDelta) => c.changeType === "unchanged").length}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
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
                      {loading ? "Processing..." : (isComparing ? "Comparison Complete" : "Extraction Complete")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {isComparing
                        ? "Delta analysis complete. Review changes before generating updated rules."
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
                        ? "Review each card to see what changed between versions."
                        : "Hover over constraint cards to see additional details."
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
