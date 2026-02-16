"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Eye,
  Loader2,
  AlertCircle,
  RefreshCw,
  GitCompare,
  Layers,
  BarChart3,
  CheckSquare
} from "lucide-react";
import { useState, useEffect } from "react";
import { MarkdownDisplay } from "@/components/constraints/MarkdownDisplay";
import { ExtractedRulesDisplay } from "@/components/constraints/ExtractedRulesDisplay";
import { GapAnalysisDisplay } from "@/components/rules/GapAnalysisDisplay";
import { RulesVersionTable } from "@/components/comparison/RulesVersionTable";

interface FileUpload {
  filename: string;
  fileType: string;
  markdown: string;
  uploadedAt: string;
  rulesetVersion?: number;
  ruleset?: {
    version: number;
    versionName: string;
    createdAt: string;
    hasRawRules: boolean;
    hasMappedRules: boolean;
    hasGapAnalysis: boolean;
  } | null;
}

interface FileUploadHistoryProps {
  customerId: string;
  refreshTrigger?: number; // Optional trigger to refresh the list
}

export function FileUploadHistory({ customerId, refreshTrigger }: FileUploadHistoryProps) {
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState<FileUpload | null>(null);
  const [selectedUploadsForComparison, setSelectedUploadsForComparison] = useState<FileUpload[]>([]);
  const [checkedUploads, setCheckedUploads] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "markdown" | "rules" | "gapAnalysis" | "mappedRules" | "comparison">("list");
  const [extractedRules, setExtractedRules] = useState<any[]>([]);
  const [mappedRules, setMappedRules] = useState<any[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<any[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRulesets, setAvailableRulesets] = useState<Array<{ version: number; versionName: string }>>([]);

  const loadFileUploads = async () => {
    if (!customerId) {
      console.log("[FileUploadHistory] No customerId provided");
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("[FileUploadHistory] Loading file uploads for customerId:", customerId);
      const response = await fetch(`/api/projects/file-uploads?customerId=${customerId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[FileUploadHistory] API error:", response.status, errorData);
        setError(errorData.error || `Failed to load file uploads (${response.status})`);
        setFileUploads([]);
        return;
      }

      const data = await response.json();
      console.log("[FileUploadHistory] Received data:", data);
      setFileUploads(data.fileUploads || []);
      
      // Also fetch available rulesets to help link file uploads
      try {
        const rulesetsResponse = await fetch(`/api/projects/rulesets?customerId=${customerId}`, {
          cache: "no-store",
        });
        if (rulesetsResponse.ok) {
          const rulesetsData = await rulesetsResponse.json();
          const rulesets = rulesetsData.rulesets?.map((rs: any) => ({
            version: rs.version,
            versionName: rs.versionName,
          })) || [];
          setAvailableRulesets(rulesets);
          
          // Try to link file uploads to rulesets if they don't have rulesetVersion
          if (rulesets.length > 0 && data.fileUploads) {
            const updatedUploads = data.fileUploads.map((upload: FileUpload, index: number) => {
              // If upload doesn't have rulesetVersion, try to match by order (latest upload = latest ruleset)
              if (!upload.rulesetVersion && index < rulesets.length) {
                const matchingRuleset = rulesets[rulesets.length - 1 - index];
                if (matchingRuleset) {
                  return {
                    ...upload,
                    rulesetVersion: matchingRuleset.version,
                  };
                }
              }
              return upload;
            });
            setFileUploads(updatedUploads);
          }
        }
      } catch (err) {
        console.error("Error loading rulesets:", err);
      }
    } catch (error) {
      console.error("[FileUploadHistory] Error loading file uploads:", error);
      setError(error instanceof Error ? error.message : "Failed to load file uploads");
      setFileUploads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFileUploads();
  }, [customerId, refreshTrigger]);

  const handleViewMarkdown = (upload: FileUpload) => {
    setSelectedUpload(upload);
    setViewMode("markdown");
  };

  const handleViewRules = async (upload: FileUpload) => {
    // Try to find rulesetVersion if not directly available
    let versionToUse = upload.rulesetVersion || upload.ruleset?.version;
    
    // Try to find from available rulesets
    if (!versionToUse && availableRulesets.length > 0) {
      const uploadIndex = fileUploads.findIndex(u => u.filename === upload.filename);
      if (uploadIndex >= 0 && uploadIndex < availableRulesets.length) {
        versionToUse = availableRulesets[availableRulesets.length - 1 - uploadIndex].version;
      } else if (availableRulesets.length > 0) {
        versionToUse = availableRulesets[availableRulesets.length - 1].version;
      }
    }
    
    // If still no version, try to fetch from API
    if (!versionToUse) {
      try {
        const response = await fetch(`/api/projects/rulesets?customerId=${customerId}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          const rulesets = data.rulesets || [];
          if (rulesets.length > 0) {
            versionToUse = rulesets[rulesets.length - 1].version;
          }
        }
      } catch (error) {
        console.error("Error finding ruleset version:", error);
      }
    }

    if (!versionToUse) {
      alert("No ruleset associated with this upload. Please wait for processing to complete or try again later.");
      return;
    }

    setSelectedUpload(upload);
    setViewMode("rules");
    setLoadingRules(true);

    try {
      const response = await fetch(
        `/api/projects/rulesets/${versionToUse}?customerId=${customerId}`,
        { cache: "no-store" }
      );

      if (response.ok) {
        const data = await response.json();
        const rawRules = data.ruleset?.data?.raw_rules || [];
        const mapped = data.ruleset?.data?.mapped_rules || [];
        const gap = data.ruleset?.data?.gap_analysis || [];
        setExtractedRules(rawRules);
        setMappedRules(mapped);
        setGapAnalysis(gap);
      } else {
        alert("Failed to load rules. Please try again.");
      }
    } catch (error) {
      console.error("Error loading rules:", error);
      alert("Error loading rules. Please try again.");
    } finally {
      setLoadingRules(false);
    }
  };

  const handleViewGapAnalysis = async (upload: FileUpload) => {
    let versionToUse = upload.rulesetVersion || upload.ruleset?.version;
    
    // Try to find from available rulesets
    if (!versionToUse && availableRulesets.length > 0) {
      const uploadIndex = fileUploads.findIndex(u => u.filename === upload.filename);
      if (uploadIndex >= 0 && uploadIndex < availableRulesets.length) {
        versionToUse = availableRulesets[availableRulesets.length - 1 - uploadIndex].version;
      } else if (availableRulesets.length > 0) {
        versionToUse = availableRulesets[availableRulesets.length - 1].version;
      }
    }
    
    if (!versionToUse) {
      alert("No ruleset associated with this upload. Please wait for processing to complete.");
      return;
    }

    setSelectedUpload(upload);
    setViewMode("gapAnalysis");
    setLoadingRules(true);

    try {
      const response = await fetch(
        `/api/projects/rulesets/${versionToUse}?customerId=${customerId}`,
        { cache: "no-store" }
      );

      if (response.ok) {
        const data = await response.json();
        const gap = data.ruleset?.data?.gap_analysis || [];
        setGapAnalysis(gap);
      } else {
        alert("Failed to load gap analysis. Please try again.");
      }
    } catch (error) {
      console.error("Error loading gap analysis:", error);
      alert("Error loading gap analysis. Please try again.");
    } finally {
      setLoadingRules(false);
    }
  };

  const handleViewMappedRules = async (upload: FileUpload) => {
    let versionToUse = upload.rulesetVersion || upload.ruleset?.version;
    
    // Try to find from available rulesets
    if (!versionToUse && availableRulesets.length > 0) {
      const uploadIndex = fileUploads.findIndex(u => u.filename === upload.filename);
      if (uploadIndex >= 0 && uploadIndex < availableRulesets.length) {
        versionToUse = availableRulesets[availableRulesets.length - 1 - uploadIndex].version;
      } else if (availableRulesets.length > 0) {
        versionToUse = availableRulesets[availableRulesets.length - 1].version;
      }
    }
    
    if (!versionToUse) {
      alert("No ruleset associated with this upload. Please wait for processing to complete.");
      return;
    }

    setSelectedUpload(upload);
    setViewMode("mappedRules");
    setLoadingRules(true);

    try {
      const response = await fetch(
        `/api/projects/rulesets/${versionToUse}?customerId=${customerId}`,
        { cache: "no-store" }
      );

      if (response.ok) {
        const data = await response.json();
        const mapped = data.ruleset?.data?.mapped_rules || [];
        setMappedRules(mapped);
      } else {
        alert("Failed to load mapped rules. Please try again.");
      }
    } catch (error) {
      console.error("Error loading mapped rules:", error);
      alert("Error loading mapped rules. Please try again.");
    } finally {
      setLoadingRules(false);
    }
  };

  const handleCompareFiles = async (uploads: FileUpload[]) => {
    if (uploads.length < 2) {
      alert("Please select at least 2 files to compare");
      return;
    }

    setSelectedUploadsForComparison(uploads);
    setViewMode("comparison");
    setLoadingComparison(true);

    try {
      const projectId = typeof window !== 'undefined' 
        ? sessionStorage.getItem("currentProjectId") || customerId
        : customerId;

      // Fetch full ruleset data for each upload
      const versionDataPromises = uploads.map(async (upload) => {
        // Try to find rulesetVersion
        let versionToUse = upload.rulesetVersion || upload.ruleset?.version;
        
        // Try to find from available rulesets
        if (!versionToUse && availableRulesets.length > 0) {
          const uploadIndex = fileUploads.findIndex(u => u.filename === upload.filename);
          if (uploadIndex >= 0 && uploadIndex < availableRulesets.length) {
            versionToUse = availableRulesets[availableRulesets.length - 1 - uploadIndex].version;
          } else if (availableRulesets.length > 0) {
            versionToUse = availableRulesets[availableRulesets.length - 1].version;
          }
        }
        
        if (!versionToUse) {
          console.warn(`No ruleset version found for ${upload.filename}`);
          return null;
        }
        
        const response = await fetch(
          `/api/projects/rulesets/${versionToUse}?customerId=${customerId}`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            version: versionToUse,
            versionName: upload.ruleset?.versionName || data.ruleset?.versionName || `v${versionToUse}`,
            createdAt: upload.uploadedAt,
            raw_rules: data.ruleset?.data?.raw_rules || [],
          };
        }
        return null;
      });

      const allVersionData = (await Promise.all(versionDataPromises)).filter(Boolean);

      if (allVersionData.length < 2) {
        alert("Could not load ruleset data for comparison");
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
      }
    } catch (error) {
      console.error("Error comparing files:", error);
      alert("Failed to compare files");
    } finally {
      setLoadingComparison(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (viewMode === "markdown" && selectedUpload) {
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {selectedUpload.filename}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode("list");
                setSelectedUpload(null);
              }}
            >
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <MarkdownDisplay 
            markdown={selectedUpload.markdown} 
            filename={selectedUpload.filename}
          />
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "rules" && selectedUpload) {
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Extracted Rules - {selectedUpload.filename}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode("list");
                setSelectedUpload(null);
                setExtractedRules([]);
              }}
            >
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingRules ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : extractedRules.length > 0 ? (
            <ExtractedRulesDisplay rules={extractedRules} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No rules found for this upload
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "gapAnalysis" && selectedUpload) {
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Gap Analysis - {selectedUpload.filename}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode("list");
                setSelectedUpload(null);
                setGapAnalysis([]);
              }}
            >
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingRules ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : gapAnalysis.length > 0 ? (
            <GapAnalysisDisplay mappedRules={gapAnalysis} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No gap analysis found for this upload
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "mappedRules" && selectedUpload) {
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Mapped Rules - {selectedUpload.filename}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMode("list");
                setSelectedUpload(null);
                setMappedRules([]);
              }}
            >
              Back to List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingRules ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : mappedRules.length > 0 ? (
            <div className="space-y-4">
              {mappedRules.map((rule, index) => (
                <Card key={index} className="p-4">
                  <h3 className="font-semibold mb-2">{rule.constraint}</h3>
                  <div className="space-y-2">
                    {rule.sentinel_allowed_values && rule.sentinel_allowed_values.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Allowed Values: </span>
                        <span className="text-sm">{rule.sentinel_allowed_values.join(", ")}</span>
                      </div>
                    )}
                    {rule.rules && rule.rules.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Rules: </span>
                        <ul className="list-disc list-inside mt-1">
                          {rule.rules.map((r: string, i: number) => (
                            <li key={i} className="text-sm">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No mapped rules found for this upload
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Don't render comparison view here - it will be shown in a dialog

  if (!customerId) {
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Previously Uploaded Files
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No project selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a project to view uploaded files
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Previously Uploaded Files
          </CardTitle>
          <div className="flex items-center gap-2">
            {checkedUploads.size >= 2 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const selected = fileUploads.filter(u => 
                    u.rulesetVersion && checkedUploads.has(u.rulesetVersion)
                  );
                  handleCompareFiles(selected);
                }}
                className="h-7 px-3"
              >
                <GitCompare className="w-3 h-3 mr-1" />
                Compare ({checkedUploads.size})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadFileUploads}
              disabled={loading}
              className="h-7 px-2"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-3" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFileUploads}
              className="mt-3"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        ) : fileUploads.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No files uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload your first guidelines document to get started
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] w-full">
            <div className="space-y-3 pr-4">
              {fileUploads.map((upload, index) => (
                <div
                  key={index}
                  className="p-4 border border-border rounded-lg hover:border-primary/30 hover:bg-accent/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <h4 className="font-semibold text-sm truncate">{upload.filename}</h4>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {upload.fileType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(upload.uploadedAt)}</span>
                        </div>
                        {upload.ruleset && (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="text-xs">
                              {upload.ruleset.versionName}
                            </Badge>
                            {upload.ruleset.hasRawRules && (
                              <Badge variant="outline" className="text-xs">
                                Rules
                              </Badge>
                            )}
                            {upload.ruleset.hasMappedRules && (
                              <Badge variant="outline" className="text-xs">
                                Mapped
                              </Badge>
                            )}
                            {upload.ruleset.hasGapAnalysis && (
                              <Badge variant="outline" className="text-xs">
                                Gap Analysis
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-3 pt-3 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewMarkdown(upload)}
                        className="w-full"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Markdown
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewRules(upload)}
                        className="w-full"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Rules
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewMappedRules(upload)}
                        className="w-full"
                      >
                        <Layers className="w-3 h-3 mr-1" />
                        Mapped
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewGapAnalysis(upload)}
                        className="w-full"
                      >
                        <BarChart3 className="w-3 h-3 mr-1" />
                        Gap Analysis
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <input
                        type="checkbox"
                        checked={checkedUploads.has(upload.rulesetVersion || upload.ruleset?.version || 0)}
                        onChange={(e) => {
                          let versionToUse = upload.rulesetVersion || upload.ruleset?.version;
                          
                          // Try to find version from available rulesets
                          if (!versionToUse && availableRulesets.length > 0) {
                            const uploadIndex = fileUploads.findIndex(u => u.filename === upload.filename);
                            if (uploadIndex >= 0 && uploadIndex < availableRulesets.length) {
                              versionToUse = availableRulesets[availableRulesets.length - 1 - uploadIndex].version;
                            } else if (availableRulesets.length > 0) {
                              versionToUse = availableRulesets[availableRulesets.length - 1].version;
                            }
                          }
                          
                          if (!versionToUse) {
                            alert("Cannot select this file for comparison. No ruleset version found. Please wait for processing to complete.");
                            return;
                          }
                          
                          const newChecked = new Set(checkedUploads);
                          if (e.target.checked) {
                            newChecked.add(versionToUse);
                          } else {
                            newChecked.delete(versionToUse);
                          }
                          setCheckedUploads(newChecked);
                        }}
                        className="w-4 h-4 rounded border-border"
                      />
                      <label className="text-xs text-muted-foreground cursor-pointer flex-1">
                        Select for comparison
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar />
          </ScrollArea>
        )}
      </CardContent>
      
      {/* Comparison Dialog - Full Page Modal */}
      <Dialog 
        open={viewMode === "comparison" && selectedUploadsForComparison.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setViewMode("list");
            setSelectedUploadsForComparison([]);
            setComparisonData(null);
            setCheckedUploads(new Set());
          }
        }}
      >
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] flex flex-col p-0 translate-x-[-50%] translate-y-[-50%] left-[50%] top-[50%]">
          <DialogHeader className="px-6 py-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-primary" />
                Comparison - {selectedUploadsForComparison.length} Files
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setViewMode("list");
                  setSelectedUploadsForComparison([]);
                  setComparisonData(null);
                  setCheckedUploads(new Set());
                }}
              >
                Close
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6 min-h-0">
            {loadingComparison ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : comparisonData ? (
              <RulesVersionTable 
                data={comparisonData}
                onStatsCalculated={() => {}}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No comparison data available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
