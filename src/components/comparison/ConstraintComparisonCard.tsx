"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Plus, Minus, RefreshCw, Gauge, TrendingUp, TrendingDown, Equal } from "lucide-react";

interface ConstraintDelta {
  id: string;
  clauseText: string;
  previousText?: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  confidence: number;
  previousConfidence?: number;
}

interface ConstraintComparisonCardProps {
  constraint: ConstraintDelta;
}

export function ConstraintComparisonCard({ constraint }: ConstraintComparisonCardProps) {
  const changeConfig = {
    added: { 
      icon: Plus, 
      label: "New Constraint", 
      accentColor: "from-emerald-400 via-emerald-500 to-emerald-600",
      bgClass: "hover:border-emerald-500/40 hover:shadow-emerald-500/5",
      badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      iconColor: "text-emerald-500"
    },
    removed: { 
      icon: Minus, 
      label: "Removed", 
      accentColor: "from-rose-400 via-rose-500 to-rose-600",
      bgClass: "hover:border-rose-500/40 hover:shadow-rose-500/5",
      badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-500/10 border-rose-500/20",
      iconColor: "text-rose-500"
    },
    modified: { 
      icon: RefreshCw, 
      label: "Modified", 
      accentColor: "from-amber-400 via-amber-500 to-amber-600",
      bgClass: "hover:border-amber-500/40 hover:shadow-amber-500/5",
      badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-500"
    },
    unchanged: { 
      icon: Equal, 
      label: "Unchanged", 
      accentColor: "from-slate-300 via-slate-400 to-slate-500",
      bgClass: "hover:border-border hover:shadow-primary/5 opacity-75",
      badgeBg: "bg-muted border-border text-muted-foreground",
      iconBg: "bg-muted border-border",
      iconColor: "text-muted-foreground"
    },
  };

  const config = changeConfig[constraint.changeType];
  const Icon = config.icon;

  const confidenceChange = constraint.previousConfidence 
    ? constraint.confidence - constraint.previousConfidence 
    : 0;

  return (
    <Card 
      className={`
        group relative overflow-hidden transition-all duration-500
        border border-border/50 hover:shadow-lg hover:-translate-y-0.5
        ${config.bgClass}
      `}
    >
      {/* Left accent bar */}
      <div 
        className={`
          absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5
          bg-gradient-to-b ${config.accentColor}
        `}
      />

      <CardHeader className="relative pb-4 pl-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${config.iconBg}`}>
              <Icon className={`w-4 h-4 ${config.iconColor}`} />
            </div>
            <div>
              <Badge className={`font-semibold ${config.badgeBg}`}>
                {config.label}
              </Badge>
              <span className="ml-3 font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                #{constraint.id}
              </span>
            </div>
          </div>
          
          {/* Confidence indicator */}
          <div className="flex items-center gap-3">
            {constraint.previousConfidence && constraint.changeType === "modified" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono tabular-nums">{constraint.previousConfidence}%</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            )}
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg border
              ${constraint.confidence >= 90 
                ? "bg-emerald-500/10 border-emerald-500/30" 
                : "bg-amber-500/10 border-amber-500/30"
              }
            `}>
              <Gauge className={`w-3.5 h-3.5 ${
                constraint.confidence >= 90 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-amber-600 dark:text-amber-400"
              }`} />
              <span className={`text-sm font-bold tabular-nums ${
                constraint.confidence >= 90 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-amber-600 dark:text-amber-400"
              }`}>
                {constraint.confidence}%
              </span>
              {confidenceChange !== 0 && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${
                  confidenceChange > 0 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-rose-600 dark:text-rose-400"
                }`}>
                  {confidenceChange > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {confidenceChange > 0 ? "+" : ""}{confidenceChange}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative pl-6">
        {constraint.changeType === "modified" && constraint.previousText ? (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Previous Version */}
            <div className="relative p-4 rounded-xl bg-rose-500/[0.03] border border-rose-500/20 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-0.5 bg-rose-500/40" />
              <div className="flex items-center gap-2 mb-2">
                <Minus className="w-3.5 h-3.5 text-rose-500" />
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Previous
                </p>
              </div>
              <p className="text-sm text-muted-foreground line-through leading-relaxed">
                {constraint.previousText}
              </p>
            </div>
            
            {/* New Version */}
            <div className="relative p-4 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/20 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500/40" />
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Updated
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed font-medium">
                {constraint.clauseText}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-sm text-foreground leading-relaxed">
              {constraint.clauseText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
