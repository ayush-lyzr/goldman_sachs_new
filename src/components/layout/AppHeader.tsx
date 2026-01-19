"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, RefreshCw } from "lucide-react";
import { UpdateGuidelinesDialog } from "@/components/dashboard/UpdateGuidelinesDialog";
import { useEffect, useState } from "react";

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
    <header className="flex items-center justify-between px-4 lg:px-6 py-4 bg-card border-b border-border">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-semibold text-foreground">
              {isLoading ? "Loading..." : displayName}
            </h2>
            <p className="text-xs text-muted-foreground">Project</p>
          </div>
          <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
        </div>
      </div>

      
    </header>
  );
}
