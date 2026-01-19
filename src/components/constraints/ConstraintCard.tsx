"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle, FileText, CheckCircle, Gauge } from "lucide-react";
import { useState } from "react";

interface Interpretation {
  id: string;
  label: string;
  description: string;
}

interface ConstraintCardProps {
  id: string;
  clauseText: string;
  sourcePage: number;
  confidence: number;
  isAmbiguous: boolean;
  interpretations?: Interpretation[];
  onInterpretationChange?: (constraintId: string, interpretationId: string) => void;
}

export function ConstraintCard({
  id,
  clauseText,
  sourcePage,
  confidence,
  isAmbiguous,
  interpretations,
  onInterpretationChange,
}: ConstraintCardProps) {
  const [selectedInterpretation, setSelectedInterpretation] = useState(
    interpretations?.[0]?.id || ""
  );

  const handleChange = (value: string) => {
    setSelectedInterpretation(value);
    onInterpretationChange?.(id, value);
  };

  const confidenceColor = confidence >= 90 
    ? "text-emerald-600 dark:text-emerald-400" 
    : confidence >= 70 
      ? "text-amber-600 dark:text-amber-400" 
      : "text-rose-600 dark:text-rose-400";
  
  const confidenceBg = confidence >= 90 
    ? "bg-emerald-500/10 border-emerald-500/30" 
    : confidence >= 70 
      ? "bg-amber-500/10 border-amber-500/30" 
      : "bg-rose-500/10 border-rose-500/30";

  return (
    <Card 
      className={`
        group relative overflow-hidden transition-all duration-500 
        hover:shadow-lg hover:-translate-y-0.5
        ${isAmbiguous 
          ? "border-amber-500/30 hover:border-amber-500/50 hover:shadow-amber-500/5" 
          : "border-border/50 hover:border-primary/30 hover:shadow-primary/5"
        }
      `}
    >
      {/* Left accent bar */}
      <div 
        className={`
          absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5
          ${isAmbiguous 
            ? "bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600" 
            : "bg-gradient-to-b from-primary/40 via-primary to-accent/60"
          }
        `}
      />
      
      {/* Hover gradient */}
      <div className={`
        absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
        ${isAmbiguous 
          ? "bg-gradient-to-br from-amber-500/[0.03] to-transparent" 
          : "bg-gradient-to-br from-primary/[0.02] to-transparent"
        }
      `} />

      <CardHeader className="relative pb-4 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {isAmbiguous && (
              <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                  Constraint #{id}
                </span>
                {isAmbiguous && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                  >
                    Needs Review
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base font-semibold leading-relaxed text-foreground group-hover:text-primary transition-colors duration-300">
                {clauseText}
              </CardTitle>
            </div>
          </div>
          
          {/* Confidence Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${confidenceBg}`}>
            <Gauge className={`w-3.5 h-3.5 ${confidenceColor}`} />
            <span className={`text-sm font-bold tabular-nums ${confidenceColor}`}>
              {confidence}%
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-4 pl-6">
        {/* Source info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border/50">
            <FileText className="w-3.5 h-3.5" />
            <span className="font-medium">Page {sourcePage}</span>
          </div>
        </div>

        {/* Interpretations */}
        {isAmbiguous && interpretations && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Select Interpretation
            </p>
            <RadioGroup value={selectedInterpretation} onValueChange={handleChange}>
              <div className="space-y-2">
                {interpretations.map((interp) => (
                  <div
                    key={interp.id}
                    className={`
                      relative flex items-start space-x-3 p-4 rounded-xl 
                      border transition-all duration-300 cursor-pointer
                      ${selectedInterpretation === interp.id 
                        ? "bg-primary/5 border-primary/30 shadow-sm" 
                        : "bg-muted/20 border-transparent hover:bg-muted/40 hover:border-border/50"
                      }
                    `}
                    onClick={() => handleChange(interp.id)}
                  >
                    {selectedInterpretation === interp.id && (
                      <div className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <RadioGroupItem 
                      value={interp.id} 
                      id={`${id}-${interp.id}`} 
                      className="mt-0.5" 
                    />
                    <Label 
                      htmlFor={`${id}-${interp.id}`} 
                      className="flex-1 cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {interp.label}
                        {selectedInterpretation === interp.id && (
                          <CheckCircle className="w-3.5 h-3.5 text-primary" />
                        )}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {interp.description}
                      </p>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
