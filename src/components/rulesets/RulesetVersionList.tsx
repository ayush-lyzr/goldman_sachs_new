"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Clock, FileText, AlertCircle, Loader2 } from "lucide-react";
import { fetchRulesets, formatRulesetDate, type RulesetMetadata } from "@/lib/rulesets";

interface RulesetVersionListProps {
  customerId: string;
  onSelectVersion?: (version: number) => void;
}

export function RulesetVersionList({ customerId, onSelectVersion }: RulesetVersionListProps) {
  const [rulesets, setRulesets] = useState<RulesetMetadata[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  useEffect(() => {
    const loadRulesets = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRulesets(customerId);
        setRulesets(data.rulesets);
        setProjectName(data.projectName);
        
        // Auto-select the latest version
        if (data.rulesets.length > 0) {
          const latest = data.rulesets[data.rulesets.length - 1];
          setSelectedVersion(latest.version);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load rulesets");
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      void loadRulesets();
    }
  }, [customerId]);

  const handleSelectVersion = (version: number) => {
    setSelectedVersion(version);
    onSelectVersion?.(version);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ruleset Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base">Ruleset Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rulesets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ruleset Versions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No rulesets generated yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          Ruleset Versions
        </CardTitle>
        {projectName && (
          <p className="text-xs text-muted-foreground">{projectName}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rulesets.map((ruleset, index) => {
            const isLatest = index === rulesets.length - 1;
            const isSelected = selectedVersion === ruleset.version;
            
            return (
              <button
                key={ruleset.version}
                onClick={() => handleSelectVersion(ruleset.version)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ruleset.versionName}</span>
                    {isLatest && (
                      <Badge variant="default" className="text-xs">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    v{ruleset.version}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Clock className="w-3 h-3" />
                  <span>{formatRulesetDate(ruleset.createdAt)}</span>
                </div>
                
                <div className="flex gap-2 text-xs">
                  {ruleset.dataPreview.hasMappedRules && (
                    <Badge variant="secondary" className="text-xs">
                      {ruleset.dataPreview.mappedRulesCount} mapped rules
                    </Badge>
                  )}
                  {ruleset.dataPreview.hasRawRules && (
                    <Badge variant="outline" className="text-xs">
                      {ruleset.dataPreview.rawRulesCount} raw rules
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {rulesets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total versions: {rulesets.length}</span>
              <span>Latest: v{rulesets[rulesets.length - 1].version}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
