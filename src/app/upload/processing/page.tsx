"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Loader2, X, Eye, GitCompare, Upload, ChevronDown, ChevronUp, Layers, BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExtractedRulesDisplay } from "@/components/constraints/ExtractedRulesDisplay";
import { MarkdownDisplay } from "@/components/constraints/MarkdownDisplay";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { GapAnalysisDisplay } from "@/components/rules/GapAnalysisDisplay";
import { RulesVersionTable } from "@/components/comparison/RulesVersionTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FileProcessingState {
  file: File;
  id: string;
  status: "pending" | "extracting" | "extracted" | "rules-mapping" | "rules-mapped" | "gap-analysis" | "gap-analyzed" | "completed" | "error";
  error?: string;
  markdown?: string;
  extractedRules?: any[];
  mappedRules?: any[];
  gapAnalysis?: any[];
  rulesetVersion?: number;
  showDetails?: boolean;
  viewMode?: "markdown" | "rules" | "mapped" | "gapAnalysis" | null;
}

export default function ProcessingPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileProcessingState[]>([]);
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Load files from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFilesData = sessionStorage.getItem('uploadedFilesData');
      if (savedFilesData) {
        try {
          const parsedFilesData = JSON.parse(savedFilesData);
          
          // Convert data URLs back to File objects
          const filePromises = parsedFilesData.map((fileData: any) => {
            return fetch(fileData.data)
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], fileData.name, { type: fileData.type });
                return {
                  file,
                  id: fileData.id,
                  status: "pending" as const,
                  showDetails: true,
                };
              });
          });

          Promise.all(filePromises).then((restoredFiles) => {
            setFiles(restoredFiles);
            
            // Start processing files
            restoredFiles.forEach((fileState: FileProcessingState) => {
              if (fileState.status === "pending") {
                processFileAsync(fileState.id, fileState);
              }
            });
          });
        } catch (error) {
          console.error("Error loading files:", error);
          router.push('/upload');
        }
      } else {
        // No files to process, redirect back
        router.push('/upload');
      }
    }
  }, [router]);

  const updateFileState = (fileId: string, updates: Partial<FileProcessingState>) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    ));
  };

  const processFileAsync = async (fileId: string, fileState: FileProcessingState) => {
    try {
      // Get customerId and projectId
      let customerId = "";
      let projectId = "";
      let isNewProject = false;
      
      if (typeof window !== 'undefined') {
        const existingCustomerId = sessionStorage.getItem("currentCustomerId");
        customerId = existingCustomerId || crypto.randomUUID();
        projectId = sessionStorage.getItem("currentProjectId") || crypto.randomUUID();
        
        isNewProject = !existingCustomerId;
        
        sessionStorage.setItem("currentCustomerId", customerId);
        sessionStorage.setItem("currentProjectId", projectId);
      }

      // Create or get project
      if (isNewProject) {
        const projectName = fileState.file.name.replace(/\.(pdf|docx)$/i, '');
        const projectResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: projectName, customerId }),
        });
        
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          projectId = projectData.id; // Use the actual MongoDB project ID
          if (typeof window !== 'undefined') {
            sessionStorage.setItem("currentProjectId", projectId);
          }
        }
      } else {
        // For existing projects, fetch the project list and find the one matching customerId
        const projectsResponse = await fetch("/api/projects");
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          const existingProject = projectsData.projects?.find(
            (p: any) => p.customerId === customerId
          );
          if (existingProject) {
            projectId = existingProject.id; // Use the actual MongoDB project ID
            if (typeof window !== 'undefined') {
              sessionStorage.setItem("currentProjectId", projectId);
            }
          }
        }
        // If we can't find the project, we'll use the UUID from sessionStorage as fallback
      }

      // Step 1: Extract markdown
      updateFileState(fileId, { status: "extracting", showDetails: true });
      const formData = new FormData();
      formData.append("files", fileState.file);

      const extractResponse = await fetch("https://chicago-cubs.onrender.com/extract-markdown", {
        method: "POST",
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error("PDF extraction failed");
      }

      const extractData = await extractResponse.json();
      if (!extractData.results || extractData.results.length === 0) {
        throw new Error("No content extracted from PDF");
      }

      const markdown = extractData.results[0].markdown;
      updateFileState(fileId, { 
        status: "extracted", 
        markdown 
      });

      // Step 2: Extract rules
      updateFileState(fileId, { status: "rules-mapping" });
      const rulesResponse = await fetch("/api/agents/rules-extractor", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId,
          customerId,
          extractorResponse: markdown 
        }),
      });

      if (!rulesResponse.ok) {
        throw new Error("Rules extraction failed");
      }

      const rulesData = await rulesResponse.json();
      if (rulesData.error) {
        throw new Error(`Rules extraction failed: ${rulesData.error}`);
      }

      const extractedRules = rulesData.rules || [];
      updateFileState(fileId, { 
        status: "rules-mapped", 
        extractedRules 
      });

      // Step 3: Map rules to columns
      // Send the full rules-extractor response as rulesExtractorResponse
      const rulesToColumnResponse = await fetch("/api/agents/rules-to-column", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rulesExtractorResponse: rulesData, 
          customerId, 
          projectId 
        }),
      });

      if (!rulesToColumnResponse.ok) {
        throw new Error("Rules mapping failed");
      }

      const rulesToColumnData = await rulesToColumnResponse.json();
      if (rulesToColumnData.error) {
        throw new Error(`Rules mapping failed: ${rulesToColumnData.error}`);
      }

      const mappedRules = rulesToColumnData.mapped_rules || [];
      
      // Fetch the project to get the latest ruleset version
      let rulesetVersion: number | undefined;
      try {
        const projectResponse = await fetch(`/api/projects?customerId=${customerId}`);
        if (projectResponse.ok) {
          const projectsData = await projectResponse.json();
          const project = projectsData.projects?.find((p: any) => p.customerId === customerId);
          if (project?.latestRuleset) {
            rulesetVersion = project.latestRuleset.version;
          }
        }
      } catch (err) {
        console.error("Error fetching project version:", err);
      }

      let selectedCompany = null;
      if (typeof window !== 'undefined') {
        const storedCompany = sessionStorage.getItem("selectedCompany");
        if (storedCompany) {
          try {
            selectedCompany = JSON.parse(storedCompany);
          } catch (err) {
            console.error("Error parsing selected company:", err);
          }
        }
      }

      // Step 4: Gap analysis
      updateFileState(fileId, { status: "gap-analysis", mappedRules, rulesetVersion });
      
      // Extract fidessa_catalog from selectedCompany if available
      const fidessa_catalog = selectedCompany?.fidessa_catalog || undefined;
      
      const gapAnalysisResponse = await fetch("/api/agents/gap-analysis", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId,
          customerId,
          rulesToColumnResponse: rulesToColumnData,
          ...(fidessa_catalog && { fidessa_catalog }),
        }),
      });

      if (!gapAnalysisResponse.ok) {
        throw new Error("Gap analysis failed");
      }

      const gapAnalysisData = await gapAnalysisResponse.json();
      if (gapAnalysisData.error) {
        throw new Error(`Gap analysis failed: ${gapAnalysisData.error}`);
      }

      const gapAnalysis = gapAnalysisData.mapped_rules || [];

      // Save to database
      await fetch("/api/projects/file-uploads", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          projectId,
          filename: fileState.file.name,
          fileType: fileState.file.type,
          markdown,
          rulesetVersion,
        }),
      });

      // Mark as completed
      const currentFileState = files.find(f => f.id === fileId);
      updateFileState(fileId, { 
        status: "completed",
        gapAnalysis,
        mappedRules: currentFileState?.mappedRules || mappedRules,
        rulesetVersion: currentFileState?.rulesetVersion || rulesetVersion,
        viewMode: currentFileState?.viewMode || "gapAnalysis",
      });

    } catch (error) {
      console.error(`Error processing file ${fileId}:`, error);
      updateFileState(fileId, { 
        status: "error",
        error: error instanceof Error ? error.message : "Failed to process file",
      });
    }
  };

  const getStatusBadge = (status: FileProcessingState["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "extracting":
        return <Badge variant="secondary">Extracting...</Badge>;
      case "extracted":
        return <Badge variant="secondary">Extracted</Badge>;
      case "rules-mapping":
        return <Badge variant="secondary">Mapping Rules...</Badge>;
      case "rules-mapped":
        return <Badge variant="secondary">Rules Mapped</Badge>;
      case "gap-analysis":
        return <Badge variant="secondary">Analyzing Gaps...</Badge>;
      case "gap-analyzed":
        return <Badge variant="secondary">Gap Analyzed</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const getStatusIcon = (status: FileProcessingState["status"]) => {
    switch (status) {
      case "extracting":
      case "rules-mapping":
      case "gap-analysis":
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "error":
        return <X className="w-4 h-4 text-destructive" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const handleCompareFiles = async () => {
    if (checkedFiles.size < 2) {
      alert("Please select at least 2 files to compare");
      return;
    }

    const selectedFiles = files.filter(f => checkedFiles.has(f.id) && f.status === "completed" && f.rulesetVersion);
    
    if (selectedFiles.length < 2) {
      alert("Please select at least 2 completed files with ruleset versions");
      return;
    }

    setLoadingComparison(true);
    setShowComparison(true);

    try {
      const customerId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentCustomerId") || ""
        : "";
      const projectId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentProjectId") || customerId
        : customerId;

      // Fetch full ruleset data for each file
      const versionDataPromises = selectedFiles.map(async (fileState) => {
        if (!fileState.rulesetVersion) return null;
        
        const response = await fetch(
          `/api/projects/rulesets/${fileState.rulesetVersion}?customerId=${customerId}`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            version: fileState.rulesetVersion,
            versionName: data.ruleset?.versionName || `v${fileState.rulesetVersion}`,
            createdAt: new Date().toISOString(),
            raw_rules: data.ruleset?.data?.raw_rules || [],
          };
        }
        return null;
      });

      const allVersionData = (await Promise.all(versionDataPromises)).filter(Boolean);

      if (allVersionData.length < 2) {
        alert("Could not load ruleset data for comparison");
        setShowComparison(false);
        return;
      }

      // Call comparison API
      const diffResponse = await fetch("/api/agents/rules-diff", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        cache: "no-store",
        body: JSON.stringify({
          projectId,
          customerId,
          versions: allVersionData,
        }),
      });

      if (diffResponse.ok) {
        const diffData = await diffResponse.json();
        setComparisonData(diffData);
      } else {
        const errorData = await diffResponse.json().catch(() => ({}));
        alert(`Comparison failed: ${errorData.error || 'Unknown error'}`);
        setShowComparison(false);
      }
    } catch (error) {
      console.error("Error comparing files:", error);
      alert("Failed to compare files");
      setShowComparison(false);
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Processing Files</h1>
          <p className="text-muted-foreground mt-1">
            {files.every(f => f.status === "completed" || f.status === "error") 
              ? "All files processed successfully" 
              : "Please wait while we process your files..."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('uploadedFilesData');
            }
            router.push('/upload');
          }}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload More Files
        </Button>
      </div>

      {/* Compare Selected Files Button - Always visible at top */}
      <Card className={`mb-6 transition-all ${checkedFiles.size >= 2 ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompare className={`w-4 h-4 ${checkedFiles.size >= 2 ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${checkedFiles.size >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
                {checkedFiles.size === 0 
                  ? "Select files below to compare" 
                  : checkedFiles.size === 1
                  ? "1 file selected (select at least 2 to compare)"
                  : `${checkedFiles.size} files selected for comparison`}
              </span>
            </div>
            <Button 
              onClick={handleCompareFiles}
              disabled={loadingComparison || checkedFiles.size < 2}
              className="gap-2"
            >
              {loadingComparison ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4" />
                  Compare Selected
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files List */}
      <div className="space-y-6">
        {files.map((fileState) => (
          <Card key={fileState.id} className="overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(fileState.status)}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{fileState.file.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(fileState.status)}
                    </div>
                    {fileState.error && (
                      <p className="text-sm text-destructive mt-2">{fileState.error}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => {
                    updateFileState(fileState.id, { 
                      showDetails: !fileState.showDetails 
                    });
                  }}
                >
                  {fileState.showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Action Buttons */}
              {(fileState.status === "completed" || fileState.markdown || fileState.extractedRules || fileState.mappedRules || fileState.gapAnalysis) && (
                <div className="grid grid-cols-4 gap-3">
                  {fileState.markdown && (
                    <Button
                      variant={fileState.viewMode === "markdown" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateFileState(fileState.id, { 
                          viewMode: fileState.viewMode === "markdown" ? null : "markdown",
                        });
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Extracted
                    </Button>
                  )}
                  {fileState.extractedRules && fileState.extractedRules.length > 0 && (
                    <Button
                      variant={fileState.viewMode === "rules" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateFileState(fileState.id, { 
                          viewMode: fileState.viewMode === "rules" ? null : "rules",
                        });
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Rules
                    </Button>
                  )}
                  {fileState.mappedRules && fileState.mappedRules.length > 0 && (
                    <Button
                      variant={fileState.viewMode === "mapped" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateFileState(fileState.id, { 
                          viewMode: fileState.viewMode === "mapped" ? null : "mapped",
                        });
                      }}
                    >
                      <Layers className="w-4 h-4 mr-2" />
                      Mapped
                    </Button>
                  )}
                  {fileState.gapAnalysis && fileState.gapAnalysis.length > 0 && (
                    <Button
                      variant={fileState.viewMode === "gapAnalysis" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateFileState(fileState.id, { 
                          viewMode: fileState.viewMode === "gapAnalysis" ? null : "gapAnalysis",
                        });
                      }}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Gap Analysis
                    </Button>
                  )}
                </div>
              )}

              {/* Comparison Checkbox - Show for completed files */}
              {fileState.status === "completed" && fileState.rulesetVersion && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`compare-${fileState.id}`}
                      checked={checkedFiles.has(fileState.id)}
                      onChange={(e) => {
                        const newChecked = new Set(checkedFiles);
                        if (e.target.checked) {
                          newChecked.add(fileState.id);
                        } else {
                          newChecked.delete(fileState.id);
                        }
                        setCheckedFiles(newChecked);
                      }}
                      className="w-5 h-5 rounded border-2 border-primary cursor-pointer accent-primary"
                    />
                    <label 
                      htmlFor={`compare-${fileState.id}`}
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <GitCompare className="w-4 h-4 text-primary" />
                      Select for comparison
                    </label>
                  </div>
                  {checkedFiles.has(fileState.id) && (
                    <Badge variant="default" className="text-xs">
                      Selected
                    </Badge>
                  )}
                </div>
              )}

              {/* Detailed View - Collapsible */}
              {fileState.showDetails && (
                <div className="pt-4 border-t space-y-4">
                  {/* Workflow Stepper */}
                  <WorkflowStepper 
                    steps={[
                      {
                        id: 1,
                        name: "Upload",
                        status: ["extracted", "rules-mapping", "rules-mapped", "gap-analysis", "gap-analyzed", "completed"].includes(fileState.status)
                          ? "completed"
                          : fileState.status === "pending" || fileState.status === "extracting"
                          ? "current"
                          : "upcoming",
                      },
                      {
                        id: 2,
                        name: "Extract",
                        status: ["extracted", "rules-mapping", "rules-mapped", "gap-analysis", "gap-analyzed", "completed"].includes(fileState.status)
                          ? "completed"
                          : fileState.status === "extracting"
                          ? "current"
                          : "upcoming",
                      },
                      {
                        id: 3,
                        name: "Generate Rules",
                        status: ["rules-mapped", "gap-analysis", "gap-analyzed", "completed"].includes(fileState.status)
                          ? "completed"
                          : fileState.status === "rules-mapping"
                          ? "current"
                          : "upcoming",
                      },
                      {
                        id: 4,
                        name: "Gap Analysis",
                        status: ["gap-analyzed", "completed"].includes(fileState.status)
                          ? "completed"
                          : fileState.status === "gap-analysis"
                          ? "current"
                          : "upcoming",
                      },
                    ]}
                  />

                  {/* Loading State */}
                  {fileState.status !== "completed" && fileState.status !== "error" && (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center">
                        <div className="relative mx-auto w-16 h-16 mb-5">
                          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                          <div className="relative flex items-center justify-center w-full h-full rounded-full bg-primary/10">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {fileState.status === "pending" && "Uploading File"}
                          {fileState.status === "extracting" && "Extracting Content"}
                          {fileState.status === "rules-mapping" && "Generating Rules"}
                          {fileState.status === "gap-analysis" && "Running Gap Analysis"}
                          {fileState.status === "extracted" && "Preparing Rules Generation"}
                          {fileState.status === "rules-mapped" && "Preparing Gap Analysis"}
                          {fileState.status === "gap-analyzed" && "Finalizing"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Processing {fileState.file.name}...
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Completed State - Show content based on viewMode */}
                  {fileState.status === "completed" && (
                    <div className="space-y-4">
                      {fileState.viewMode === "markdown" && fileState.markdown && (
                        <MarkdownDisplay markdown={fileState.markdown} filename={fileState.file.name} />
                      )}
                      {fileState.viewMode === "rules" && fileState.extractedRules && fileState.extractedRules.length > 0 && (
                        <ExtractedRulesDisplay rules={fileState.extractedRules} />
                      )}
                      {fileState.viewMode === "mapped" && fileState.mappedRules && fileState.mappedRules.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold">Mapped Rules</h4>
                          <div className="space-y-4">
                            {fileState.mappedRules.map((rule: any, index: number) => (
                              <Card key={index} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-primary/70">
                                      #{String(index + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="font-semibold text-base">
                                      {rule.constraint?.replace(/_/g, ' ') || `Constraint ${index + 1}`}
                                    </h3>
                                  </div>
                                  {rule.rules && Array.isArray(rule.rules) && rule.rules.length > 0 && (
                                    <div className="space-y-2 pl-6">
                                      {rule.rules.map((r: string, ruleIndex: number) => (
                                        <div 
                                          key={ruleIndex}
                                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border/50 transition-all"
                                        >
                                          <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                                            <span className="font-mono text-[10px] font-bold text-primary/70">
                                              {ruleIndex + 1}
                                            </span>
                                          </div>
                                          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                                            {r}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      {fileState.viewMode === "gapAnalysis" && fileState.gapAnalysis && fileState.gapAnalysis.length > 0 && (
                        <GapAnalysisDisplay mappedRules={fileState.gapAnalysis} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Dialog - Full Page Popup */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold">Compare Files</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComparison(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {checkedFiles.size >= 2 && (
              <p className="text-sm text-muted-foreground mt-1">
                Comparing {checkedFiles.size} file{checkedFiles.size > 1 ? 's' : ''}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6">
            {loadingComparison ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <span className="text-base text-muted-foreground">Comparing files...</span>
                <span className="text-sm text-muted-foreground mt-2">This may take a few moments</span>
              </div>
            ) : comparisonData ? (
              <RulesVersionTable 
                data={comparisonData}
                onStatsCalculated={() => {}}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <GitCompare className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-base text-muted-foreground">No comparison data available</p>
                <p className="text-sm text-muted-foreground mt-2">Please try comparing again</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
