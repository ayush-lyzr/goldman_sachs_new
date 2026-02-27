"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CheckCircle2, XCircle, Info, ArrowRight, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface ConstraintDelta {
  constraint: string;
  rules: string[];
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

interface GapAnalysisDisplayProps {
  mappedRules: ConstraintDelta[];
}

interface SelectedCompany {
  companyId: string;
  companyName: string;
  fidessa_catalog: Record<string, string>;
}

export function GapAnalysisDisplay({ mappedRules }: GapAnalysisDisplayProps) {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCompany | null>(null);

  const parseNumericSpan = (value: string): { min: number; max: number } | null => {
    const trimmed = value.trim().replace(/%/g, "");
    const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }

    const singleMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
    if (!singleMatch) return null;
    const n = Number(singleMatch[1]);
    if (!Number.isFinite(n)) return null;
    return { min: n, max: n };
  };

  const overlapsSpan = (a: { min: number; max: number }, b: { min: number; max: number }) =>
    Math.max(a.min, b.min) <= Math.min(a.max, b.max);

  const getPdfMatchForSentinelValue = (
    pdfAllowedValues: string[],
    pdfNotAllowedValues: string[],
    sentinelValue: string
  ): { included: boolean; excluded: boolean; related: boolean } => {
    const sentinel = sentinelValue.trim();
    if (!sentinel) return { included: false, excluded: false, related: false };

    // Exact match first (non-numeric constraints)
    if (pdfNotAllowedValues.includes(sentinel)) {
      return { included: false, excluded: true, related: true };
    }
    if (pdfAllowedValues.includes(sentinel)) {
      return { included: true, excluded: false, related: true };
    }

    // Numeric/range overlap (e.g. coupon ranges)
    const sentinelSpan = parseNumericSpan(sentinel);
    if (!sentinelSpan) return { included: false, excluded: false, related: false };

    let included = false;
    let excluded = false;

    for (const v of pdfNotAllowedValues) {
      const span = parseNumericSpan(v);
      if (span && overlapsSpan(sentinelSpan, span)) {
        excluded = true;
        break;
      }
    }

    if (!excluded) {
      for (const v of pdfAllowedValues) {
        const span = parseNumericSpan(v);
        if (span && overlapsSpan(sentinelSpan, span)) {
          included = true;
          break;
        }
      }
    }

    return { included, excluded, related: included || excluded };
  };

  // Load selected customer from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCompany = sessionStorage.getItem("currentSelectedCompany");
      if (storedCompany) {
        try {
          const company = JSON.parse(storedCompany) as SelectedCompany;
          setSelectedCustomer(company);
        } catch (error) {
          console.error("Error parsing selected company:", error);
        }
      }
    }
  }, []);

  // Format constraint name by removing underscores and converting to title case
  const formatConstraintName = (name: string) => {
    return name
      .split('_')
      .map(word => {
        if (word === word.toUpperCase() && word.length <= 3) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  // Sanitize value by removing HTML-like tags, template literals, and cleaning up the text
  const sanitizeValue = (value: string): string => {
    if (!value) return value;
    // Remove template literals (e.g., {{ fidessa_catalog }}, {{ variable }})
    let cleaned = value.replace(/\{\{[^}]*\}\}/g, '').trim();
    // Remove HTML-like tags (e.g., <keyword>, </keyword>)
    cleaned = cleaned.replace(/<[^>]*>/g, '').trim();
    // Remove any remaining angle brackets that might be part of the text
    cleaned = cleaned.replace(/[<>]/g, '');
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  const matchedCount = mappedRules.filter(r => r.matched).length;
  const totalCount = mappedRules.length;
  const matchPercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;


  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-5 text-white">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
        
        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl" />
        
        <div className="relative flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Gap Analysis Results</p>
                <h2 className="text-lg font-bold tracking-tight">{totalCount} Constraints Analyzed</h2>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            {/* Match Rate Gauge */}
            <div className="relative flex flex-col items-center">
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-white/10"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${matchPercentage}, 100`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold">{matchPercentage}%</span>
                  <span className="text-[9px] uppercase tracking-wider text-white/50">match</span>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <div className="text-2xl font-bold text-emerald-400">{matchedCount}</div>
                <div className="text-[10px] text-emerald-300/70 uppercase tracking-wider font-medium">Matched</div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <div className="text-2xl font-bold text-amber-400">{totalCount - matchedCount}</div>
                <div className="text-[10px] text-amber-300/70 uppercase tracking-wider font-medium">Gaps Found</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col lg:flex-row gap-3 px-5 py-3 bg-muted/20 rounded-lg border border-border/50">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            PDF Values
          </span>
          <Badge
            variant="outline"
            className="text-[11px] font-medium px-2 py-0.5 bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          >
            Allowed
          </Badge>
        </div>

        <div className="hidden lg:block w-px bg-border/60 mx-1" />

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Sentinel Values
          </span>
          <Badge
            variant="outline"
            className="text-[11px] font-medium px-2 py-0.5 bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
          >
            Allowed by PDF
          </Badge>
          <Badge
            variant="outline"
            className="text-[11px] font-medium px-2 py-0.5 bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-300"
          >
            Prohibited by PDF
          </Badge>
          <Badge
            variant="outline"
            className="text-[11px] font-medium px-2 py-0.5 bg-slate-500/5 border-slate-500/20 text-slate-600 dark:text-slate-400"
          >
            Not Mentioned
          </Badge>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 gap-6 px-5 py-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="col-span-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Constraint
          </span>
        </div>
        <div className="col-span-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            PDF Values
          </span>
        </div>
        <div className="col-span-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            Sentinel Values {selectedCustomer && `(${selectedCustomer.companyName})`}
          </span>
        </div>
        <div className="col-span-2 text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Status
          </span>
        </div>
      </div>

      {/* Constraint Rows */}
      <div className="space-y-3">
        {mappedRules.map((rule, index) => (
          <HoverCard key={index} openDelay={250} closeDelay={120}>
            <HoverCardTrigger asChild>
              <Card 
                className={`
                  group relative overflow-hidden border transition-all duration-500 cursor-pointer
                  animate-fade-up opacity-0
                  ${rule.matched 
                    ? 'border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5' 
                    : 'border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5'
                  }
                `}
                style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                {/* Left accent bar */}
                <div 
                  className={`
                    absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5
                    ${rule.matched 
                      ? 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600' 
                      : 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600'
                    }
                  `}
                />

                {/* Hover gradient */}
                <div className={`
                  absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
                  ${rule.matched 
                    ? 'bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-emerald-500/[0.03]' 
                    : 'bg-gradient-to-r from-amber-500/[0.03] via-transparent to-amber-500/[0.03]'
                  }
                `} />

                <div className="relative grid grid-cols-12 gap-6 p-5 pl-7">
                  {/* Constraint Name */}
                  <div className="col-span-3 flex items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-[10px] font-bold text-primary/50 tracking-wider">
                          #{String(index + 1).padStart(2, '0')}
                        </span>
                        {rule.delta && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-3.5 bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
                            HAS DELTA
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-300 leading-snug tracking-tight">
                        {formatConstraintName(rule.constraint)}
                      </h4>
                    </div>
                  </div>

                  {/* PDF Values */}
                  <div className="col-span-3 space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const legacyPdf = rule.pdf_value ?? [];
                        const pdfAllowedValues =
                          rule.allowed_values ??
                          legacyPdf.filter(v => !v.trim().startsWith("!")).map(v => v.trim()).filter(Boolean);

                        if (pdfAllowedValues.length === 0) {
                          return <span className="text-xs text-muted-foreground/50 italic">—</span>;
                        }

                        return (
                          <>
                            {pdfAllowedValues.map((value, valueIndex) => (
                              <Badge
                                key={`pdf-allowed-${valueIndex}`}
                                variant="outline"
                                className="text-[11px] font-medium px-2 py-0.5 transition-all duration-300 bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                              >
                                {sanitizeValue(value)}
                              </Badge>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Sentinel Values */}
                  <div className="col-span-4 space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        const catalogEntry = selectedCustomer?.fidessa_catalog?.[rule.constraint];
                        const sentinelSourceValues =
                          rule.fidessa_value && rule.fidessa_value.length > 0
                            ? rule.fidessa_value
                            : typeof catalogEntry === "string" && catalogEntry.trim()
                              ? [catalogEntry]
                              : [];

                        if (sentinelSourceValues.length === 0) {
                          return <span className="text-xs text-muted-foreground/50 italic">—</span>;
                        }
                        
                        // Split comma-separated values and flatten the array, sanitizing each value
                        const allValues = sentinelSourceValues.flatMap(value => 
                          value.split(',').map(v => sanitizeValue(v.trim())).filter(v => v)
                        );

                        const legacyPdf = rule.pdf_value ?? [];
                        const pdfAllowedValues =
                          rule.allowed_values ??
                          legacyPdf
                            .filter(v => !v.trim().startsWith("!"))
                            .map(v => v.trim())
                            .filter(Boolean);
                        const pdfNotAllowedValues =
                          rule.not_allowed_values ??
                          legacyPdf
                            .filter(v => v.trim().startsWith("!"))
                            .map(v => v.trim().replace(/^!\s*/, ""))
                            .filter(Boolean);
                        
                        // Always show ALL sentinel (Fidessa) values.
                        if (allValues.length === 0) {
                          return <span className="text-xs text-muted-foreground/50 italic">—</span>;
                        }
                        
                        return allValues.map((value, valueIndex) => {
                          const match = getPdfMatchForSentinelValue(pdfAllowedValues, pdfNotAllowedValues, value);
                          const isExcludedInPdf = match.excluded;
                          const isIncludedInPdf = match.included;
                          const isNeutral = !isExcludedInPdf && !isIncludedInPdf;
                          
                          return (
                            <Badge
                              key={valueIndex}
                              variant="outline"
                              className={`
                                text-[11px] font-medium px-2 py-0.5 transition-all duration-300
                                ${
                                  isIncludedInPdf
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 ring-2 ring-emerald-500/20'
                                    : 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 ring-2 ring-amber-500/20'
                                }
                              `}
                            >
                              {sanitizeValue(value)}
                              {isNeutral ? null : isExcludedInPdf ? (
                                <XCircle className="w-3 h-3 ml-1 inline" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 ml-1 inline" />
                              )}
                            </Badge>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      {rule.matched ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Match
                          </span>
                        </div>
                      ) : (
                        (() => {
                          const pdfValues = (rule.pdf_value ?? []).map(v => sanitizeValue(v));
                          const sentinelSourceValues =
                            rule.fidessa_value && rule.fidessa_value.length > 0
                              ? rule.fidessa_value
                              : [];
                          const allSentinelValues = sentinelSourceValues.flatMap(value =>
                            value.split(",").map(v => sanitizeValue(v.trim())).filter(v => v)
                          );
                          const sentinelSet = new Set(allSentinelValues);
                          const unmatchedCount = pdfValues.filter(v => v && !sentinelSet.has(v)).length;
                          const totalPdf = pdfValues.filter(v => v).length;

                          const gapLabel =
                            totalPdf > 0 ? `${unmatchedCount}/${totalPdf} gap` : "Gap";

                          return (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                              <XCircle className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                {gapLabel}
                              </span>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Delta Section */}
                {rule.delta && expandedIndex === index && (
                  <div className="relative border-t border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-amber-500/[0.03] to-amber-500/5 p-4 animate-fade-up">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/15">
                        <Info className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                          Gap Analysis
                        </p>
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          {rule.delta}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        <span>Click to collapse</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expand indicator for items with delta */}
                {rule.delta && expandedIndex !== index && (
                  <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                )}
              </Card>
            </HoverCardTrigger>

            {rule.rules && rule.rules.length > 0 && (
              <HoverCardContent
                side="bottom"
                align="start"
                sideOffset={10}
                className="w-[min(640px,calc(100vw-2rem))] p-0 overflow-hidden border-slate-500/20"
              >
                <div className="p-4 bg-gradient-to-br from-slate-500/10 via-slate-500/[0.03] to-transparent">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/20">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-foreground">
                          Extracted Rules
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          Hover preview
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {rule.rules.map((ruleText, ruleIndex) => (
                          <div key={ruleIndex} className="flex gap-2">
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">•</span>
                            <p className="text-xs text-foreground/80 leading-relaxed flex-1">
                              {ruleText}
                            </p>
                          </div>
                        ))}
                      </div>
                     
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            )}
          </HoverCard>
        ))}
      </div>

    </div>
  );
}
