"use client";

import { Button } from "@/components/ui/button";
import { GitCompare, FileText, ArrowLeftRight, Loader2 } from "lucide-react";

interface ComparisonToggleProps {
  isComparing: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export function ComparisonToggle({ isComparing, onToggle, isLoading }: ComparisonToggleProps) {
  return (
    <div className="relative">
      <Button 
        variant={isComparing ? "default" : "outline"} 
        size="sm"
        onClick={onToggle}
        disabled={isLoading}
        className={`
          relative gap-2.5 px-4 h-10 font-semibold transition-all duration-300
          ${isComparing 
            ? 'bg-white text-slate-900 hover:bg-white/90 shadow-lg' 
            : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30'
          }
        `}
      >
        <div className="relative">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isComparing ? (
            <FileText className="w-4 h-4" />
          ) : (
            <ArrowLeftRight className="w-4 h-4" />
          )}
        </div>
        <span className="text-sm">
          {isLoading ? "Comparing..." : isComparing ? "Exit Compare" : "Compare Versions"}
        </span>
        {!isComparing && !isLoading && (
          <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold uppercase tracking-wider">
            <GitCompare className="w-3 h-3" />
          </div>
        )}
      </Button>
      
      {/* Subtle glow effect when in compare mode */}
      {isComparing && (
        <div className="absolute inset-0 rounded-md bg-white/20 blur-md -z-10" />
      )}
    </div>
  );
}
