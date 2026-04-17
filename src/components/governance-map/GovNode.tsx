import { Handle, Position, NodeProps } from "@xyflow/react";
import { Building, Users, User, FileText, Scale, AlertTriangle, ShieldCheck, KeyRound, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type GovNodeType = "entity" | "organ" | "person" | "policy" | "obligation" | "finding" | "control" | "delegation" | "sii";

export interface GovNodeData extends Record<string, unknown> {
  label: string;
  type: GovNodeType;
  status?: { label: string; tone: "active" | "warning" | "critical" | "pending" };
  emphasized?: boolean;
}

const typeStyles: Record<GovNodeType, { bg: string; border: string; icon: LucideIcon; iconColor: string; label: string }> = {
  entity:     { bg: "bg-[#dbeafe]", border: "border-blue-300",   icon: Building,       iconColor: "text-blue-700",   label: "Entidad" },
  organ:      { bg: "bg-[#e0e7ff]", border: "border-indigo-300", icon: Users,          iconColor: "text-indigo-700", label: "Órgano" },
  person:     { bg: "bg-[#f3e8ff]", border: "border-purple-300", icon: User,           iconColor: "text-purple-700", label: "Persona" },
  policy:     { bg: "bg-[#fef3c7]", border: "border-amber-300",  icon: FileText,       iconColor: "text-amber-700",  label: "Política" },
  obligation: { bg: "bg-[#dcfce7]", border: "border-green-300",  icon: Scale,          iconColor: "text-green-700",  label: "Obligación" },
  finding:    { bg: "bg-[#fee2e2]", border: "border-red-300",    icon: AlertTriangle,  iconColor: "text-red-700",    label: "Hallazgo" },
  control:    { bg: "bg-[#cffafe]", border: "border-cyan-300",   icon: ShieldCheck,    iconColor: "text-cyan-700",   label: "Control" },
  delegation: { bg: "bg-[#ffedd5]", border: "border-orange-300", icon: KeyRound,       iconColor: "text-orange-700", label: "Delegación" },
  sii:        { bg: "bg-[#fef3c7]", border: "border-amber-500",  icon: Lock,           iconColor: "text-amber-800",  label: "Caso SII" },
};

const toneClasses = {
  active:   "bg-status-active text-white",
  warning:  "bg-status-warning text-white",
  critical: "bg-destructive text-destructive-foreground",
  pending:  "bg-status-pending text-white",
};

export function GovNode({ data }: NodeProps) {
  const d = data as GovNodeData;
  const s = typeStyles[d.type];
  const Icon = s.icon;
  const isFinding = d.type === "finding";
  return (
    <div
      className={cn(
        "rounded-lg border-2 px-3 py-2 shadow-sm min-w-[180px] max-w-[220px]",
        s.bg,
        s.border,
        d.emphasized && "border-destructive border-[3px] shadow-lg pulse-ring",
        isFinding && d.emphasized && "ring-2 ring-destructive/40",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/40 !border-0 !w-2 !h-2" />
      <div className="flex items-start justify-between gap-2">
        <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", s.iconColor)} />
        {d.status && (
          <span className={cn("rounded-full px-1.5 py-0 text-[9px] font-bold uppercase leading-tight", toneClasses[d.status.tone])}>
            {d.status.label}
          </span>
        )}
      </div>
      <div className="mt-1 text-[12px] font-semibold leading-tight text-foreground">{d.label}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/40 !border-0 !w-2 !h-2" />
    </div>
  );
}
