"use client";

import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
  status: "completed" | "current" | "upcoming";
}

interface WorkflowStepperProps {
  steps: Step[];
}

export function WorkflowStepper({ steps }: WorkflowStepperProps) {
  return (
    <nav aria-label="Progress" className="mb-5 relative">
      {/* Background accent */}
      <div className="absolute inset-0 -mx-4 rounded-xl bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02]" />
      
      <div className="relative py-4 px-2">
        <ol className="flex items-center justify-between">
          {steps.map((step, stepIdx) => (
            <li 
              key={step.name} 
              className={cn(
                "relative flex items-center group",
                stepIdx !== steps.length - 1 && "flex-1"
              )}
              style={{ animationDelay: `${stepIdx * 0.1}s` }}
            >
              {/* Step indicator and label */}
              <div className="flex items-center relative z-10">
                {/* Step circle */}
                <div className="relative">
                  <span
                    className={cn(
                      "relative flex items-center justify-center w-9 h-9 rounded-lg text-sm font-semibold transition-all duration-500 font-mono",
                      step.status === "completed" && "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25",
                      step.status === "current" && "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/30 ring-2 ring-primary/20",
                      step.status === "upcoming" && "bg-muted/80 text-muted-foreground border-2 border-dashed border-muted-foreground/20"
                    )}
                  >
                    {step.status === "completed" ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : step.status === "current" ? (
                      <span className="relative text-xs">
                        {step.id}
                        <span className="absolute -top-0.5 -right-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-300 animate-pulse" />
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs">{step.id}</span>
                    )}
                  </span>
                  
                  {/* Pulse ring for current step */}
                  {step.status === "current" && (
                    <span className="absolute inset-0 rounded-lg animate-ping bg-primary/30" style={{ animationDuration: '2s' }} />
                  )}
                  
                  {/* Subtle glow for completed */}
                  {step.status === "completed" && (
                    <span className="absolute inset-0 rounded-lg bg-emerald-400/20 blur-md" />
                  )}
                </div>
                
                {/* Step label */}
                <div className="ml-3 hidden sm:block">
                  <span
                    className={cn(
                      "text-sm font-semibold tracking-tight transition-colors duration-300",
                      step.status === "current" && "text-foreground",
                      step.status === "completed" && "text-emerald-600 dark:text-emerald-400",
                      step.status === "upcoming" && "text-muted-foreground/60"
                    )}
                  >
                    {step.name}
                  </span>
                  {step.status === "current" && (
                    <div className="text-[9px] uppercase tracking-widest text-primary/70 font-semibold mt-0.5">
                      In Progress
                    </div>
                  )}
                  {step.status === "completed" && (
                    <div className="text-[9px] uppercase tracking-widest text-emerald-500/70 font-semibold mt-0.5">
                      Complete
                    </div>
                  )}
                </div>
              </div>
              
              {/* Connector line */}
              {stepIdx !== steps.length - 1 && (
                <div className="hidden sm:flex flex-1 items-center mx-6">
                  <div className="relative flex-1 h-[2px]">
                    {/* Background track */}
                    <div className="absolute inset-0 bg-border/60 rounded-full" />
                    
                    {/* Filled progress */}
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                        step.status === "completed" 
                          ? "w-full bg-gradient-to-r from-emerald-500 to-emerald-400" 
                          : "w-0"
                      )}
                    />
                    
                    {/* Animated dot for current */}
                    {step.status === "completed" && steps[stepIdx + 1]?.status === "current" && (
                      <div 
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary animate-pulse"
                        style={{ animationDuration: '1.5s' }}
                      />
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
