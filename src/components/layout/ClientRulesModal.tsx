"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Settings2, 
  Globe, 
  Briefcase, 
  Shield, 
  Tag, 
  TrendingUp,
  Calendar,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Building2,
  Database
} from "lucide-react";

interface CustomerCatalog {
  Issuer_Country?: string;
  Coupon_Rate?: string;
  Sector?: string;
  Instrument_Type?: string;
  Composite_Rating?: string;
  IG_Flag?: string;
  Days_to_Maturity?: string;
  Shariah_Compliant?: string;
  [key: string]: string | undefined;
}

interface SelectedCompany {
  companyId: string;
  companyName: string;
  fidessa_catalog: CustomerCatalog;
}

interface FieldConfig {
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
}

// Icon and color mapping for catalog fields
const fieldConfig: Record<string, FieldConfig> = {
  Issuer_Country: { 
    icon: Globe, 
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200"
  },
  Sector: { 
    icon: Briefcase, 
    bg: "bg-violet-50",
    text: "text-violet-600",
    border: "border-violet-200"
  },
  Composite_Rating: { 
    icon: Shield, 
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200"
  },
  Instrument_Type: { 
    icon: Tag, 
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200"
  },
  Coupon_Rate: { 
    icon: TrendingUp, 
    bg: "bg-rose-50",
    text: "text-rose-600",
    border: "border-rose-200"
  },
  Days_to_Maturity: { 
    icon: Calendar, 
    bg: "bg-sky-50",
    text: "text-sky-600",
    border: "border-sky-200"
  },
  IG_Flag: { 
    icon: CheckCircle2, 
    bg: "bg-teal-50",
    text: "text-teal-600",
    border: "border-teal-200"
  },
  Shariah_Compliant: { 
    icon: Sparkles, 
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    border: "border-indigo-200"
  },
};

const defaultFieldConfig: FieldConfig = { 
  icon: Tag, 
  bg: "bg-slate-50",
  text: "text-slate-600",
  border: "border-slate-200"
};

export function ClientRulesModal() {
  const [selectedCompany, setSelectedCompany] = useState<SelectedCompany | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      const storedCompany = sessionStorage.getItem("currentSelectedCompany");
      if (storedCompany) {
        try {
          setSelectedCompany(JSON.parse(storedCompany));
        } catch (error) {
          console.error("Error parsing selected company:", error);
          setSelectedCompany(null);
        }
      } else {
        setSelectedCompany(null);
      }
    }
  }, [isOpen]);

  const formatFieldName = (name: string): string => {
    return name
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .trim();
  };

  const toggleExpanded = (key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderFieldValue = (key: string, value: string, config: FieldConfig) => {
    const values = value.split(",").map((v) => v.trim()).filter(Boolean);
    const isExpanded = expandedFields.has(key);
    const showExpand = values.length > 10;
    const displayValues = showExpand && !isExpanded ? values.slice(0, 10) : values;
    
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {displayValues.map((v, i) => (
            <span 
              key={i} 
              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md
                ${config.bg} ${config.text} border ${config.border}
                hover:shadow-sm transition-shadow duration-150 cursor-default`}
            >
              {v}
            </span>
          ))}
          {showExpand && !isExpanded && (
            <button
              onClick={() => toggleExpanded(key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md
                bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-150 transition-colors`}
            >
              +{values.length - 10} more
            </button>
          )}
        </div>
        {showExpand && isExpanded && (
          <button
            onClick={() => toggleExpanded(key)}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180" />
            Show less
          </button>
        )}
      </div>
    );
  };

  const catalogEntries = selectedCompany 
    ? Object.entries(selectedCompany.fidessa_catalog).filter(([, value]) => value)
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 group"
        >
          <Database className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
          <span className="hidden sm:inline text-sm font-medium">Client Rules</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-xl">
        <DialogTitle className="sr-only">Client Configuration</DialogTitle>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#64A8F0] shadow-md">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Client Configuration
              </h2>
              <p className="text-xs text-slate-500">
                Investment rules & constraints catalog
              </p>
            </div>
          </div>
        </div>

        {selectedCompany ? (
          <div>
            {/* Client Info Banner */}
            <div className="px-5 py-3 bg-gradient-to-r from-blue-50 via-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                  <Building2 className="w-4 h-4 text-[#64A8F0]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {selectedCompany.companyName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedCompany.companyId}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] text-slate-500">
                      {catalogEntries.length} categories
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-700">Active</span>
                </div>
              </div>
            </div>

            {/* Catalog Values */}
            <ScrollArea className="h-[420px]">
              <div className="p-4 space-y-3">
                {catalogEntries.map(([key, value], index) => {
                  const config = fieldConfig[key] || defaultFieldConfig;
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200 overflow-hidden"
                      style={{ 
                        animationDelay: `${index * 40}ms`,
                        animation: 'fadeIn 0.3s ease-out forwards',
                        opacity: 0
                      }}
                    >
                      <div className="p-3">
                        {/* Field Header */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className={`p-1.5 rounded-md ${config.bg} ${config.text}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            {formatFieldName(key)}
                          </h4>
                          <div className="flex-1" />
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                            {value?.split(',').length || 0}
                          </span>
                        </div>
                        
                        {/* Values */}
                        {value && renderFieldValue(key, value, config)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400">
                  Synced just now
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <Sparkles className="w-3 h-3 text-[#64A8F0]" />
                  Powered by Fidessa
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-12 px-6">
            <div className="text-center max-w-xs mx-auto">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">
                No Client Selected
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Select a project to view the client&apos;s investment rules configuration.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/projects';
                }}
              >
                Go to Projects
              </Button>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
