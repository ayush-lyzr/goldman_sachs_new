"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { WorkflowStepper } from "@/components/workflow/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  Mail, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Calendar
} from "lucide-react";
import { useRouter } from "next/navigation";

const steps = [
  { id: 1, name: "Upload", status: "completed" as const },
  { id: 2, name: "Extract", status: "completed" as const },
  { id: 3, name: "Generate Rules", status: "completed" as const },
  { id: 4, name: "Gap Analysis", status: "completed" as const },
  // { id: 5, name: "Simulate", status: "completed" as const },
];

const sectionLinks = [
  { name: "Executive Summary", id: "summary" },
  { name: "Extracted Constraints", id: "constraints" },
  { name: "Generated Rules", id: "rules" },
  { name: "Gap Analysis", id: "gaps" },
  { name: "Universe Simulation", id: "simulation" },
  { name: "Compliance Status", id: "status" },
];

export default function ReportPage() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compliance Report</h1>
            <p className="text-muted-foreground">Review and download comprehensive documentation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            <Button>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        <WorkflowStepper steps={steps} />

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Navigation Sidebar */}
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sectionLinks.map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="block px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                >
                  {link.name}
                </a>
              ))}
            </CardContent>
          </Card>

          {/* Report Preview */}
          <div className="lg:col-span-3 space-y-6">
            {/* Executive Summary */}
            <Card id="summary">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Executive Summary</CardTitle>
                  <Badge variant="success">Fully Compliant</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Global Equity Fund</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>January 16, 2026</span>
                  </div>
                </div>

                <p className="text-sm leading-relaxed">
                  This compliance verification report analyzes the Investment Guidelines document dated Q4 2024 
                  against the current Fidessa Sentinel database configuration. The analysis identified 6 constraints, 
                  all of which are properly configured in the database. No configuration gaps were found.
                </p>

                <div className="grid sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="font-semibold text-success">6 Matched</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Rules correctly configured</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="w-5 h-5 text-muted-foreground/40" />
                      <span className="font-semibold text-muted-foreground">0 Missing</span>
                    </div>
                    <p className="text-xs text-muted-foreground">No gaps found</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-muted-foreground/40" />
                      <span className="font-semibold text-muted-foreground">0 Partial</span>
                    </div>
                    <p className="text-xs text-muted-foreground">All rules complete</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Constraints Section */}
            <Card id="constraints">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg">Extracted Constraints</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {[
                    { text: "Minimum Credit Rating: BBB- or higher", confidence: 95 },
                    { text: "Single Issuer Limit: 5% maximum", confidence: 98 },
                    { text: "Russia Country Exclusion: Full restriction", confidence: 98 },
                    { text: "ESG Exclusions: Tobacco & Weapons", confidence: 92 },
                    { text: "Sector Limit (Financials): 25% maximum", confidence: 78 },
                  ].map((constraint, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm">{constraint.text}</span>
                      <Badge variant={constraint.confidence >= 90 ? "success" : "warning"}>
                        {constraint.confidence}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Compliance Status */}
            <Card id="status">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg">Compliance Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="p-6 rounded-lg border border-success/30 bg-success/5 text-center">
                  <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                  <h4 className="font-semibold text-lg text-success">All Rules Verified</h4>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    All 6 extracted constraints from the Investment Guidelines have been successfully matched 
                    against the Fidessa Sentinel database configuration. No action items required.
                  </p>
                </div>

                <Separator />

                <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" onClick={() => router.push("/")}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    New Analysis
                  </Button>
                  <Button>
                    <Download className="w-4 h-4 mr-2" />
                    Download Full Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
