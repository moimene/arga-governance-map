import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: "primary" | "warning" | "critical" | "success" | "neutral";
  to?: string;
}

const toneStyles = {
  primary: { iconBg: "bg-primary/10", icon: "text-primary", value: "text-primary" },
  warning: { iconBg: "bg-status-warning/10", icon: "text-status-warning", value: "text-status-warning" },
  critical: { iconBg: "bg-destructive/10", icon: "text-destructive", value: "text-destructive" },
  success: { iconBg: "bg-status-active/10", icon: "text-status-active", value: "text-status-active" },
  neutral: { iconBg: "bg-muted", icon: "text-muted-foreground", value: "text-foreground" },
};

export function KpiCard({ label, value, icon: Icon, tone, to }: KpiCardProps) {
  const s = toneStyles[tone];
  const inner = (
    <>
      <div className={cn("text-[32px] font-bold leading-none tracking-tight transition-colors", to && "group-hover:underline", s.value)}>
        {value}
      </div>
      <div className="mt-2 text-[13px] font-medium leading-tight text-muted-foreground">{label}</div>
    </>
  );
  return (
    <Card className="group p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.iconBg)}>
          <Icon className={cn("h-5 w-5", s.icon)} />
        </div>
      </div>
      {to ? <Link to={to} className="mt-3 block">{inner}</Link> : <div className="mt-3">{inner}</div>}
    </Card>
  );
}
