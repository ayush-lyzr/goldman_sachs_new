"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Loader2, X, Eye, GitCompare, Upload, ChevronDown, ChevronUp, Layers, BarChart3 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExtractedRulesDisplay } from "@/components/constraints/ExtractedRulesDisplay";
import { MarkdownDisplay } from "@/components/constraints/MarkdownDisplay";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { GapAnalysisDisplay } from "@/components/rules/GapAnalysisDisplay";
import { RulesVersionTable } from "@/components/comparison/RulesVersionTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layout/AppLayout";

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
  const [viewMode, setViewMode] = useState<"comparison" | "gapAnalysis">("comparison");
  
  // Track which files have been processed to prevent duplicates (React StrictMode causes useEffect to run twice)
  const processedFilesRef = useRef<Set<string>>(new Set());
  // Track if there were existing files in the project before this upload
  const hadExistingFilesRef = useRef<boolean>(false);

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

          Promise.all(filePromises).then(async (restoredFiles) => {
            setFiles(restoredFiles);
            
            // Check if there are existing files in the project before processing
            const customerId = typeof window !== 'undefined' 
              ? sessionStorage.getItem("currentCustomerId") || ""
              : "";
            
            if (customerId) {
              try {
                const existingFilesResponse = await fetch(
                  `/api/projects/file-uploads?customerId=${customerId}`,
                  { cache: "no-store" }
                );
                if (existingFilesResponse.ok) {
                  const existingFilesData = await existingFilesResponse.json();
                  const existingFiles = existingFilesData.fileUploads || [];
                  // Check if there are existing files with versions
                  const hasExistingVersions = existingFiles.some(
                    (f: any) => f.rulesetVersion !== undefined && f.rulesetVersion !== null
                  );
                  hadExistingFilesRef.current = hasExistingVersions;
                  console.log(`[ProcessingPage] Existing files in project: ${existingFiles.length}, with versions: ${hasExistingVersions}`);
                }
              } catch (error) {
                console.error("[ProcessingPage] Error checking existing files:", error);
              }
            }
            
            // Process files sequentially (one after another) to ensure proper versioning
            // and avoid database version conflicts
            for (const fileState of restoredFiles) {
              // Skip if already processed (React StrictMode can cause useEffect to run twice)
              if (processedFilesRef.current.has(fileState.id)) {
                console.log(`[ProcessingPage] Skipping already processed file: ${fileState.id}`);
                continue;
              }
              
              if (fileState.status === "pending") {
                processedFilesRef.current.add(fileState.id);
                console.log(`[ProcessingPage] Processing file: ${fileState.id} (${fileState.file.name})`);
                await processFileAsync(fileState.id, fileState);
              }
            }
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

      // Generate a unique file ID for this upload
      const uniqueFileId = `${Date.now()}-${crypto.randomUUID()}`;
      console.log(`Processing file with unique ID: ${uniqueFileId}`);
      
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
      // Also send fileId so we can find the file upload and assign version
      const rulesToColumnResponse = await fetch("/api/agents/rules-to-column", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rulesExtractorResponse: rulesData, 
          customerId, 
          projectId,
          fileId: uniqueFileId, // Pass unique file ID to identify the file upload
          filename: fileState.file.name, // Also pass filename for logging
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
      
      // Get the version directly from the rules-to-column response
      // This ensures each file gets its correct version, especially during concurrent uploads
      const rulesetVersion = rulesToColumnData.version;
      console.log(`File "${fileState.file.name}" assigned version: ${rulesetVersion}`);

      // Step 4: Gap analysis
      updateFileState(fileId, { status: "gap-analysis", mappedRules, rulesetVersion });
      
      // Get fidessa_catalog from selectedCompany stored in sessionStorage
      let fidessa_catalog: Record<string, string> | undefined = undefined;
      if (typeof window !== 'undefined') {
        const storedCompany = sessionStorage.getItem("currentSelectedCompany");
        if (storedCompany) {
          try {
            const selectedCompany = JSON.parse(storedCompany);
            // Extract fidessa_catalog from the selectedCompany object
            fidessa_catalog = selectedCompany?.fidessa_catalog;
            if (fidessa_catalog) {
              console.log(`[ProcessingPage] Using fidessa_catalog for file "${fileState.file.name}":`, fidessa_catalog);
            }
          } catch (err) {
            console.error("[ProcessingPage] Error parsing selected company:", err);
          }
        }
      }
      
      const gapAnalysisResponse = await fetch("/api/agents/gap-analysis", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId,
          customerId,
          rulesToColumnResponse: rulesToColumnData,
          ...(fidessa_catalog && { fidessa_catalog }),
          ...(rulesetVersion && { rulesetVersion }), // Pass the specific version to update
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

      // Save file upload with all data including ruleset version
      // This is the ONLY place we save file uploads - ensures no duplicate records
      if (rulesetVersion) {
        await fetch("/api/projects/file-uploads", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            fileId: uniqueFileId,
            filename: fileState.file.name,
            fileType: fileState.file.type || "application/pdf",
            markdown,
            rulesetVersion,
          }),
        });
      }

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

  // Auto-compare when files are completed
  // If there were existing files, compare all versions (old + new)
  // If no existing files, compare only new files (if 2+)
  useEffect(() => {
    const completedFiles = files.filter(f => f.status === "completed" && f.rulesetVersion);
    const allFilesCompleted = files.length > 0 && files.every(f => 
      f.status === "completed" || f.status === "error"
    );
    
    // Only auto-compare if all files are done processing
    if (!allFilesCompleted || loadingComparison || comparisonData) {
      return;
    }
    
    // If there were existing files, compare ALL versions (old + new)
    if (hadExistingFilesRef.current && completedFiles.length > 0) {
      console.log("[ProcessingPage] Existing files detected, comparing all versions with new uploads");
      setViewMode("comparison");
      setShowComparison(true);
      handleCompareAllVersions(completedFiles);
    } 
    // If no existing files, only compare if 2+ new files were uploaded
    else if (!hadExistingFilesRef.current && completedFiles.length >= 2 && viewMode === "comparison") {
      console.log("[ProcessingPage] No existing files, comparing new files only");
      const allCompletedIds = new Set(completedFiles.map(f => f.id));
      setCheckedFiles(allCompletedIds);
      handleCompareFilesInternal(completedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, viewMode]);

  // Helper function to poll for comparison job results
  const pollComparisonJob = async (jobId: string, maxAttempts: number = 60): Promise<any> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const pollResponse = await fetch(`/api/agents/rules-diff?jobId=${jobId}`, {
        cache: "no-store",
      });

      if (!pollResponse.ok) {
        throw new Error(`Failed to poll job status: ${pollResponse.statusText}`);
      }

      const jobStatus = await pollResponse.json();

      if (jobStatus.status === "completed") {
        return jobStatus.result;
      }

      if (jobStatus.status === "failed") {
        throw new Error(jobStatus.error || "Comparison job failed");
      }

      // Wait before next poll (exponential backoff: 1s, 2s, 3s, ... up to 5s)
      const waitTime = Math.min(1000 * (attempt + 1), 5000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    throw new Error("Comparison job timed out");
  };

  const handleCompareAllVersions = async (newFiles: FileProcessingState[]) => {
    setLoadingComparison(true);
    setShowComparison(true);

    try {
      const customerId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentCustomerId") || ""
        : "";
      const projectId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentProjectId") || customerId
        : customerId;

      // Fetch all existing rulesets from the project
      const rulesetsResponse = await fetch(
        `/api/projects/rulesets?customerId=${customerId}`,
        { cache: "no-store" }
      );

      if (!rulesetsResponse.ok) {
        throw new Error("Failed to fetch existing rulesets");
      }

      const rulesetsData = await rulesetsResponse.json();
      const allRulesets = rulesetsData.rulesets || [];

      if (allRulesets.length < 2) {
        console.log("[ProcessingPage] Not enough rulesets for comparison");
        setLoadingComparison(false);
        return;
      }

      // Sort by version number
      const sortedRulesets = allRulesets.sort((a: any, b: any) => 
        (a.version || 0) - (b.version || 0)
      );

      // Fetch full ruleset data for each version
      const versionDataPromises = sortedRulesets.map(async (ruleset: any) => {
        const version = ruleset.version;
        const response = await fetch(
          `/api/projects/rulesets/${version}?customerId=${customerId}`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            version: version,
            versionName: data.ruleset?.versionName || `v${version}`,
            createdAt: data.ruleset?.createdAt || new Date().toISOString(),
            raw_rules: data.ruleset?.data?.raw_rules || [],
          };
        }
        return null;
      });

      let allVersionData = (await Promise.all(versionDataPromises)).filter(Boolean);

      // Ensure versions are sorted by version number (v1, v2, v3, v4...) with latest last
      allVersionData = allVersionData.sort((a: any, b: any) => (a.version || 0) - (b.version || 0));

      if (allVersionData.length < 2) {
        console.log("[ProcessingPage] Could not load enough ruleset data for comparison");
        setLoadingComparison(false);
        return;
      }

      const latestVersion = allVersionData[allVersionData.length - 1];
      if (latestVersion) {
        console.log(`[ProcessingPage] Versions to compare: ${allVersionData.map((v: any) => v.versionName).join(' → ')} (${latestVersion.versionName} is current/latest)`);
      }

      // Start comparison job
      console.log(`[ProcessingPage] Starting comparison job for ${allVersionData.length} versions`);
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

      if (!diffResponse.ok) {
        const errorData = await diffResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start comparison job');
      }

      const jobData = await diffResponse.json();
      const jobId = jobData.jobId;

      if (!jobId) {
        throw new Error("No jobId returned from comparison API");
      }

      console.log(`[ProcessingPage] Comparison job ${jobId} started, polling for results...`);

      // Poll for results
      const diffData = await pollComparisonJob(jobId);
      setComparisonData(diffData);
      console.log(`[ProcessingPage] Comparison completed with ${allVersionData.length} versions`);
    } catch (error) {
      console.error("[ProcessingPage] Error comparing all versions:", error);
      alert(error instanceof Error ? error.message : "Failed to compare versions");
      setShowComparison(false);
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleCompareFilesInternal = async (filesToCompare: FileProcessingState[]) => {
    if (filesToCompare.length < 2) {
      return;
    }

    setLoadingComparison(true);

    try {
      const customerId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentCustomerId") || ""
        : "";
      const projectId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentProjectId") || customerId
        : customerId;

      // Only compare the versions from the files that were just uploaded
      // Sort by version number to ensure proper order
      const versionsToCompare = filesToCompare
        .map(f => f.rulesetVersion)
        .filter((v): v is number => v !== undefined)
        .sort((a, b) => a - b); // Sort ascending

      if (versionsToCompare.length < 2) {
        alert("Could not determine versions for comparison");
        setLoadingComparison(false);
        return;
      }

      // Fetch full ruleset data for each file's version
      const versionDataPromises = versionsToCompare.map(async (version) => {
        const response = await fetch(
          `/api/projects/rulesets/${version}?customerId=${customerId}`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            version: version,
            versionName: data.ruleset?.versionName || `v${version}`,
            createdAt: data.ruleset?.createdAt || new Date().toISOString(),
            raw_rules: data.ruleset?.data?.raw_rules || [],
          };
        }
        return null;
      });

      let allVersionData = (await Promise.all(versionDataPromises)).filter(Boolean);

      // Ensure versions are sorted by version number (v1, v2, v3, v4...) with latest last
      allVersionData = allVersionData.sort((a: any, b: any) => (a.version || 0) - (b.version || 0));

      if (allVersionData.length < 2) {
        alert("Could not load ruleset data for comparison");
        setShowComparison(false);
        return;
      }

      const latestVersion = allVersionData[allVersionData.length - 1];
      if (latestVersion) {
        console.log(`[ProcessingPage] Versions to compare: ${allVersionData.map((v: any) => v.versionName).join(' → ')} (${latestVersion.versionName} is current/latest)`);
      }

      // Start comparison job
      console.log(`[ProcessingPage] Starting comparison job for ${allVersionData.length} versions`);
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

      if (!diffResponse.ok) {
        const errorData = await diffResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start comparison job');
      }

      const jobData = await diffResponse.json();
      const jobId = jobData.jobId;

      if (!jobId) {
        throw new Error("No jobId returned from comparison API");
      }

      console.log(`[ProcessingPage] Comparison job ${jobId} started, polling for results...`);

      // Poll for results
      const diffData = await pollComparisonJob(jobId);
      setComparisonData(diffData);
    } catch (error) {
      console.error("Error comparing files:", error);
      alert(error instanceof Error ? error.message : "Failed to compare files");
      setShowComparison(false);
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleCompareFiles = async () => {
    const completedFiles = files.filter(f => f.status === "completed" && f.rulesetVersion);
    if (completedFiles.length < 2) {
      alert("Please wait for at least 2 files to complete processing");
      return;
    }
    handleCompareFilesInternal(completedFiles);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* View Mode Toggle - Show when 2+ files are completed OR when 1+ file completed with existing files */}
      {(files.filter(f => f.status === "completed" && f.rulesetVersion).length >= 2 || 
        (hadExistingFilesRef.current && files.filter(f => f.status === "completed" && f.rulesetVersion).length >= 1)) ? (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {viewMode === "comparison" ? (
                  <GitCompare className="w-4 h-4 text-primary" />
                ) : (
                  <BarChart3 className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm font-medium">
                  {viewMode === "comparison" ? "Comparison View" : "Gap Analysis View"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => {
                    setViewMode("comparison");
                    // If there are existing files and comparison data not loaded, trigger comparison
                    if (hadExistingFilesRef.current && !comparisonData && !loadingComparison) {
                      const completedFiles = files.filter(f => f.status === "completed" && f.rulesetVersion);
                      if (completedFiles.length > 0) {
                        handleCompareAllVersions(completedFiles);
                      }
                    }
                  }}
                  variant={viewMode === "comparison" ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <GitCompare className="w-4 h-4" />
                  Comparison
                </Button>
                <Button 
                  onClick={() => setViewMode("gapAnalysis")}
                  variant={viewMode === "gapAnalysis" ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  View Gap Analysis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      sessionStorage.removeItem('uploadedFilesData');
                    }
                    router.push('/upload');
                  }}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload More Files
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('uploadedFilesData');
                  }
                  router.push('/upload');
                }}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload More Files
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Table - Show inline when in comparison mode */}
      {viewMode === "comparison" && 
       (files.filter(f => f.status === "completed" && f.rulesetVersion).length >= 2 || 
        (hadExistingFilesRef.current && files.filter(f => f.status === "completed" && f.rulesetVersion).length >= 1)) && (
        <Card className="mb-6">
          <CardContent className="p-6">
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
                <p className="text-base text-muted-foreground">Preparing comparison...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                      {fileState.rulesetVersion && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono">
                          v{fileState.rulesetVersion}
                        </Badge>
                      )}
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

                  {/* Completed State - Show gap analysis in gap analysis mode */}
                  {fileState.status === "completed" && viewMode === "gapAnalysis" && fileState.gapAnalysis && fileState.gapAnalysis.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold">{fileState.file.name} - Gap Analysis</h4>
                        {fileState.rulesetVersion && (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono">
                            v{fileState.rulesetVersion}
                          </Badge>
                        )}
                      </div>
                      <GapAnalysisDisplay mappedRules={fileState.gapAnalysis} />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </AppLayout>
  );
}
