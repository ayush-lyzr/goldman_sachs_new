"use client";

import { Button } from "@/components/ui/button";
import { GitCompare, FileText, ArrowLeftRight, Loader2, ChevronDown, Clock, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export interface VersionInfo {
  version: number;
  versionName: string;
  createdAt: string;
  isLatest?: boolean;
}

interface ComparisonToggleProps {
  isComparing: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  versions?: VersionInfo[];
  selectedVersion?: number;
  onVersionSelect?: (version: number) => void;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export function ComparisonToggle({ 
  isComparing, 
  onToggle, 
  isLoading,
  versions = [],
  selectedVersion,
  onVersionSelect 
}: ComparisonToggleProps) {
  const selectedVersionInfo = versions.find(v => v.version === selectedVersion);
  const hasVersions = versions.length > 0;

  return (
    <div className="relative flex items-center gap-2">
      {/* Version Dropdown - visible in both modes */}
      {hasVersions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className={`gap-2 px-3 h-9 font-medium transition-all duration-200 ${
                isComparing
                  ? 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300 shadow-sm'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">
                {selectedVersionInfo?.versionName || 'Version'}
              </span>
              {selectedVersionInfo?.isLatest && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                  isComparing 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  Latest
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-64 p-1 bg-white border border-slate-200 shadow-xl rounded-xl"
          >
            <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Compare with Version
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <div className="py-1">
              {versions.map((version) => {
                const isSelected = selectedVersion === version.version;
                return (
                  <DropdownMenuItem
                    key={version.version}
                    onClick={() => onVersionSelect?.(version.version)}
                    className={`flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-slate-100' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors ${
                      isSelected 
                        ? 'bg-[#64A8F0] border-[#64A8F0]' 
                        : 'border-slate-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{version.versionName}</span>
                        {version.isLatest && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(version.createdAt)}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button 
        variant={isComparing ? "default" : "outline"} 
        size="sm"
        onClick={onToggle}
        disabled={isLoading || (!isComparing && !selectedVersion)}
        className={`
          relative gap-2 px-4 h-9 font-semibold transition-all duration-200
          ${isComparing 
            ? 'bg-white text-slate-900 hover:bg-white/90 shadow-md' 
            : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30'
          }
        `}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isComparing ? (
          <FileText className="w-4 h-4" />
        ) : (
          <ArrowLeftRight className="w-4 h-4" />
        )}
        <span className="text-sm">
          {isLoading ? "Comparing..." : isComparing ? "Exit Compare" : "Compare"}
        </span>
      </Button>
    </div>
  );
}
