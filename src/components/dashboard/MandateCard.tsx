import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { UpdateGuidelinesDialog } from "./UpdateGuidelinesDialog";

interface MandateCardProps {
  name: string;
  lastVerified: string;
  status: "compliant" | "review" | "issues";
  rulesCount: number;
  clientType?: string;
}

export function MandateCard({ name, lastVerified, status, rulesCount, clientType }: MandateCardProps) {
  const router = useRouter();
  
  const statusConfig = {
    compliant: { label: "Compliant", variant: "success" as const },
    review: { label: "Under Review", variant: "warning" as const },
    issues: { label: "Issues Found", variant: "destructive" as const },
  };

  const currentStatus = statusConfig[status];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{name}</CardTitle>
            {clientType && <p className="text-xs text-muted-foreground mt-0.5">{clientType}</p>}
          </div>
          <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>Verified {lastVerified}</span>
          </div>
          <span>•</span>
          <span>{rulesCount} rules</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => router.push("/constraints")}>
            View Guidelines
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
          <UpdateGuidelinesDialog portfolioName={name}>
            <Button variant="ghost" size="sm" className="px-2" title="Update Guidelines">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </UpdateGuidelinesDialog>
        </div>
      </CardContent>
    </Card>
  );
}

