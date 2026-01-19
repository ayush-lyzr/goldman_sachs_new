"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck2, Sparkles, ChevronRight, BookOpen } from "lucide-react";
import { useState } from "react";

interface ExtractedRule {
  title: string;
  rules: string[];
}

interface ExtractedRulesDisplayProps {
  rules: ExtractedRule[];
}

export function ExtractedRulesDisplay({ rules }: ExtractedRulesDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<number[]>(
    rules.map((_, i) => i) // All expanded by default
  );

  const toggleSection = (index: number) => {
    setExpandedSections(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const totalRules = rules.reduce((acc, section) => acc + section.rules.length, 0);

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent border border-primary/10 p-4">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-0.5">
                Document Analysis Complete
              </p>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">
                {rules.length} Sections Containing {totalRules} Investment Requirements
              </h3>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-background/80 border border-border/50 backdrop-blur-sm">
              <div className="text-lg font-bold text-primary tabular-nums">{rules.length}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Sections</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-background/80 border border-border/50 backdrop-blur-sm">
              <div className="text-lg font-bold text-primary tabular-nums">{totalRules}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Rules</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Cards */}
      <div className="space-y-4">
        {rules.map((section, sectionIndex) => {
          const isExpanded = expandedSections.includes(sectionIndex);
          
          return (
            <Card 
              key={sectionIndex}
              className={`
                group relative overflow-hidden border border-border/50 
                transition-all duration-500 
                hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5
                animate-fade-up opacity-0
                ${isExpanded ? 'bg-card' : 'bg-card/50'}
              `}
              style={{ animationDelay: `${sectionIndex * 0.1}s`, animationFillMode: 'forwards' }}
            >
              {/* Left accent bar with gradient */}
              <div 
                className={`
                  absolute inset-y-0 left-0 w-1 transition-all duration-500
                  bg-gradient-to-b from-primary/40 via-primary to-accent/60
                  ${isExpanded ? 'w-1.5' : 'w-1'}
                  group-hover:w-1.5
                `}
              />
              
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer pointer-events-none" />

              {/* Header - Always visible */}
              <button
                onClick={() => toggleSection(sectionIndex)}
                className="w-full text-left p-6 pl-8 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors duration-300"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative p-2.5 rounded-xl bg-primary/5 border border-primary/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300">
                    <FileCheck2 className="w-5 h-5 text-primary" />
                    {/* Floating sparkle */}
                    <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs font-bold text-primary/50 tracking-wider">
                        Section {String(sectionIndex + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors duration-300 truncate pr-4">
                      {section.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge 
                    variant="outline" 
                    className="text-xs font-semibold shrink-0 bg-primary/5 border-primary/20 px-3 py-1.5 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5 inline-block text-primary/60" />
                    {section.rules.length} {section.rules.length === 1 ? 'Rule' : 'Rules'}
                  </Badge>
                  
                  <ChevronRight 
                    className={`
                      w-5 h-5 text-muted-foreground transition-transform duration-300
                      ${isExpanded ? 'rotate-90' : 'rotate-0'}
                    `} 
                  />
                </div>
              </button>

              {/* Expandable Rules List */}
              <div 
                className={`
                  overflow-hidden transition-all duration-500 ease-out
                  ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
                `}
              >
                <div className="px-6 pb-6 pl-8 pt-0">
                  {/* Divider */}
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      Requirements
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-l from-border via-border/50 to-transparent" />
                  </div>

                  {/* Rules Grid */}
                  <div className="space-y-3">
                    {section.rules.map((rule, ruleIndex) => (
                      <div 
                        key={ruleIndex}
                        className={`
                          group/rule relative flex items-start gap-4 p-4 rounded-xl
                          bg-muted/20 hover:bg-muted/40 
                          border border-transparent hover:border-border/50
                          transition-all duration-300 cursor-default
                          animate-fade-up opacity-0
                        `}
                        style={{ 
                          animationDelay: `${(sectionIndex * 0.1) + (ruleIndex * 0.05)}s`,
                          animationFillMode: 'forwards'
                        }}
                      >
                        {/* Rule number indicator */}
                        <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 group-hover/rule:from-primary/20 group-hover/rule:to-primary/10 group-hover/rule:border-primary/20 transition-all duration-300">
                          <span className="font-mono text-[11px] font-bold text-primary/70 group-hover/rule:text-primary tabular-nums">
                            {ruleIndex + 1}
                          </span>
                        </div>
                        
                        {/* Rule text */}
                        <p className="flex-1 text-sm leading-relaxed text-muted-foreground group-hover/rule:text-foreground/90 transition-colors duration-300">
                          {rule}
                        </p>
                        
                        {/* Hover accent */}
                        <div className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-primary/0 group-hover/rule:bg-primary/30 transition-all duration-300" />
                      </div>
                    ))}
                  </div>

                  {/* Section Footer */}
                  <div className="mt-5 pt-4 border-t border-border/30 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <div className="w-12 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                      <span className="font-medium tracking-wide uppercase">
                        {section.rules.length} {section.rules.length === 1 ? 'Requirement' : 'Requirements'} in Section
                      </span>
                      <div className="w-12 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
