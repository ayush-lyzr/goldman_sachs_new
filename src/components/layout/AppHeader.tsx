"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, RefreshCw } from "lucide-react";
import { UpdateGuidelinesDialog } from "@/components/dashboard/UpdateGuidelinesDialog";
import { ClientRulesModal } from "./ClientRulesModal";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface AppHeaderProps {
  mandateName?: string;
  status?: "compliant" | "review" | "issues";
}

export function AppHeader({ mandateName, status = "compliant" }: AppHeaderProps) {
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const customerId = sessionStorage.getItem("currentCustomerId");
        if (!customerId) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/projects/${customerId}`);
        if (response.ok) {
          const data = await response.json();
          setProjectName(data.name);
        }
      } catch (error) {
        console.error("Error fetching project data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, []);

  const statusConfig = {
    compliant: { label: "Compliant", variant: "success" as const },
    review: { label: "Under Review", variant: "warning" as const },
    issues: { label: "Issues Found", variant: "destructive" as const },
  };

  const currentStatus = statusConfig[status];
  const displayName = mandateName || projectName || "No Project Loaded";

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-2 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-6">
        {/* Goldman Sachs Logo */}
        <Link
          href="/"
          aria-label="Go to home"
          className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 hover:opacity-80 active:opacity-70 transition-opacity"
        >
          <div className="flex items-center justify-center">
            <Image 
              src="/Goldman-logo.svg" 
              alt="Goldman Sachs" 
              width={64} 
              height={64}
              className="w-16 h-16"
            />
          </div>
          
        </Link>
        
        {/* Project Info */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-6 ml-2">
          <h2 className="font-semibold text-slate-900 text-sm">
            {isLoading ? "Loading..." : displayName} Project
          </h2>
          
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <ClientRulesModal />
      </div>
    </header>
  );
}
