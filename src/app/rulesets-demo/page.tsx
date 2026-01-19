"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RulesetVersionList } from "@/components/rulesets/RulesetVersionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, GitCompare } from "lucide-react";

/**
 * Demo page showing how to use the ruleset versioning system
 * 
 * This page demonstrates:
 * 1. Displaying ruleset versions for a project
 * 2. Selecting and viewing a specific version
 * 3. Comparing versions
 */
export default function RulesetsDemo() {
  const [customerId, setCustomerId] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [rulesetData, setRulesetData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Get customerId from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = sessionStorage.getItem("currentCustomerId");
      if (storedId) {
        setCustomerId(storedId);
      }
    }
  }, []);

  // Fetch specific ruleset version when selected
  const handleVersionSelect = async (version: number) => {
    setSelectedVersion(version);
    setLoading(true);
    
    try {
      const response = await fetch(`/api/projects/rulesets/${version}?customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setRulesetData(data.ruleset);
      }
    } catch (error) {
      console.error("Error fetching ruleset:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ruleset Versions</h1>
          <p className="text-muted-foreground">
            View and manage different versions of generated rulesets
          </p>
        </div>

        {!customerId ? (
          <Card className="border-warning/50">
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                No project selected. Please create or select a project first.
              </p>
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Version List */}
            <div className="lg:col-span-1">
              <RulesetVersionList 
                customerId={customerId}
                onSelectVersion={handleVersionSelect}
              />
            </div>

            {/* Main Content - Selected Version Details */}
            <div className="lg:col-span-2">
              {loading ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ) : selectedVersion && rulesetData ? (
                <div className="space-y-4">
                  {/* Version Header */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {rulesetData.versionName}
                        </CardTitle>
                        <Badge variant="default">
                          Version {rulesetData.version}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(rulesetData.createdAt).toLocaleString()}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">Mapped Rules</p>
                          <p className="text-2xl font-bold">
                            {rulesetData.data.mapped_rules?.length || 0}
                          </p>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">Raw Rules</p>
                          <p className="text-2xl font-bold">
                            {rulesetData.data.raw_rules?.length || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Mapped Rules */}
                  {rulesetData.data.mapped_rules && rulesetData.data.mapped_rules.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Mapped Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {rulesetData.data.mapped_rules.map((rule: any, index: number) => (
                            <div 
                              key={index}
                              className="p-4 border border-border rounded-lg bg-accent/30"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-sm">{rule.constraint}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {rule.sentinel_allowed_values.length} values
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p className="font-medium">Allowed Values:</p>
                                <div className="flex flex-wrap gap-1">
                                  {rule.sentinel_allowed_values.map((value: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {value}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {rule.rules && rule.rules.length > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  <p className="font-medium">Rules:</p>
                                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                                    {rule.rules.map((r: string, idx: number) => (
                                      <li key={idx}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Raw Rules */}
                  {rulesetData.data.raw_rules && rulesetData.data.raw_rules.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <GitCompare className="w-4 h-4" />
                          Raw Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {rulesetData.data.raw_rules.map((category: any, index: number) => (
                            <div 
                              key={index}
                              className="p-4 border border-border rounded-lg"
                            >
                              <h4 className="font-medium text-sm mb-2">{category.title}</h4>
                              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                {category.rules.map((rule: string, idx: number) => (
                                  <li key={idx}>{rule}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Select a version from the list to view details
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
