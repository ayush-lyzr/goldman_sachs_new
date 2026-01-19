"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, FileText, GitBranch, Clock, Loader2, AlertCircle as AlertCircleIcon } from "lucide-react";
import { fetchRulesets, formatRulesetDate, type RulesetMetadata } from "@/lib/rulesets";
import Link from "next/link";

const UploadPage = () => {
  const [customerId, setCustomerId] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [rulesets, setRulesets] = useState<RulesetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get customerId from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = sessionStorage.getItem("currentCustomerId");
      if (storedId) {
        setCustomerId(storedId);
        loadRulesets(storedId);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadRulesets = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRulesets(id);
      setRulesets(data.rulesets);
      setProjectName(data.projectName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  };

  const totalRules = rulesets.reduce(
    (acc, rs) => acc + (rs.dataPreview.mappedRulesCount || 0),
    0
  );
  const latestRuleset = rulesets.length > 0 ? rulesets[rulesets.length - 1] : null;

  const stats = [
    { label: "Versions", value: rulesets.length.toString(), icon: GitBranch, iconClass: "text-primary" },
    { label: "Total Rules", value: totalRules.toString(), icon: FileText, iconClass: "text-success" },
    { label: "Latest Version", value: latestRuleset?.versionName || "N/A", icon: CheckCircle, iconClass: "text-success" },
    { label: "Project", value: projectName || "N/A", icon: AlertTriangle, iconClass: "text-muted-foreground" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Monitor ruleset versions and upload new guidelines</p>
        </div>

        {!customerId ? (
          <Card className="border-warning/50">
            <CardContent className="py-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircleIcon className="w-5 h-5" />
                <div>
                  <p className="text-sm font-medium">No project selected</p>
                  <p className="text-xs text-muted-foreground">Please create or select a project first.</p>
                </div>
              </div>
              <Button 
                className="mt-4" 
                variant="outline"
                onClick={() => window.location.href = "/projects"}
              >
                Go to Projects
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <stat.icon className={`w-8 h-8 ${stat.iconClass}`} />
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Content */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Commented out Ruleset Versions Card */}
              {/* <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Ruleset Versions</CardTitle>
                      {projectName && (
                        <Badge variant="outline">{projectName}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : error ? (
                      <div className="flex items-center gap-2 text-destructive py-8">
                        <AlertCircleIcon className="w-5 h-5" />
                        <span className="text-sm">{error}</span>
                      </div>
                    ) : rulesets.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground mb-2">No versions generated yet</p>
                        <p className="text-xs text-muted-foreground">Upload guidelines to create your first version</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rulesets.map((ruleset, index) => {
                          const isLatest = index === rulesets.length - 1;
                          
                          return (
                            <Link
                              key={ruleset.version}
                              href={`/rulesets-demo`}
                              className="block"
                            >
                              <div className="p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer h-full">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <GitBranch className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-sm">{ruleset.versionName}</span>
                                  </div>
                                  {isLatest && (
                                    <Badge variant="default" className="text-xs">
                                      Latest
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatRulesetDate(ruleset.createdAt)}</span>
                                </div>
                                
                                <div className="space-y-2">
                                  {ruleset.dataPreview.hasMappedRules && (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground">Mapped Rules</span>
                                      <Badge variant="secondary" className="text-xs">
                                        {ruleset.dataPreview.mappedRulesCount}
                                      </Badge>
                                    </div>
                                  )}
                                  {ruleset.dataPreview.hasRawRules && (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground">Raw Rules</span>
                                      <Badge variant="outline" className="text-xs">
                                        {ruleset.dataPreview.rawRulesCount}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="mt-3 pt-3 border-t border-border">
                                  <p className="text-xs text-muted-foreground">Version {ruleset.version}</p>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div> */}

              <div className="lg:col-span-2 space-y-6">
                <UploadZone />
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Versions</span>
                      <span className="font-semibold">{rulesets.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Rules</span>
                      <span className="font-semibold">{totalRules}</span>
                    </div>
                    {latestRuleset && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Latest Version</span>
                          <span className="font-semibold">{latestRuleset.versionName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last Updated</span>
                          <span className="font-semibold text-xs">{formatRulesetDate(latestRuleset.createdAt)}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default UploadPage;
