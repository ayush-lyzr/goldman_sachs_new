import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, FileText, Clock } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "verified",
    message: "Global Equity Fund verified as compliant",
    time: "2 hours ago",
    icon: CheckCircle,
    iconClass: "text-success",
  },
  {
    id: 2,
    type: "warning",
    message: "European Bond mandate requires review",
    time: "5 hours ago",
    icon: AlertTriangle,
    iconClass: "text-warning",
  },
  {
    id: 3,
    type: "upload",
    message: "New guidelines uploaded for Asia Pacific Fund",
    time: "1 day ago",
    icon: FileText,
    iconClass: "text-primary",
  },
  {
    id: 4,
    type: "pending",
    message: "Constraint extraction completed",
    time: "2 days ago",
    icon: Clock,
    iconClass: "text-muted-foreground",
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <activity.icon className={`w-5 h-5 mt-0.5 ${activity.iconClass}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{activity.message}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
