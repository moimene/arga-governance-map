import { cn } from "@/lib/utils";

type Tone =
  | "active"
  | "warning"
  | "critical"
  | "archived"
  | "pending"
  | "draft"
  | "info"
  | "neutral";

const toneClasses: Record<Tone, string> = {
  active: "bg-status-active-bg text-status-active border-status-active/30",
  warning: "bg-status-warning-bg text-status-warning border-status-warning/30",
  critical: "bg-status-critical-bg text-status-critical border-status-critical/30",
  archived: "bg-status-archived-bg text-status-archived border-status-archived/30",
  pending: "bg-status-pending-bg text-status-pending border-status-pending/30",
  draft: "bg-status-draft-bg text-status-draft border-status-draft/30",
  info: "bg-accent text-primary border-primary/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

function statusToTone(status: string): Tone {
  const s = status.toUpperCase();
  if (["VIGENTE", "ACTIVA", "EFECTIVO", "CUBIERTO", "CERRADO"].includes(s)) return "active";
  if (["EN REVISIÓN", "ASIGNADO", "EN REMEDIACIÓN", "PENDIENTE VALIDACIÓN", "EN PROCESO", "PLANIFICADA", "CONVOCADA"].includes(s)) return "warning";
  if (["CRÍTICA", "CRITICO", "CRÍTICO", "ABIERTO", "EN INVESTIGACIÓN", "ALTA", "SIN CONTROL", "CADUCADA"].includes(s)) return "critical";
  if (["ARCHIVADA", "ARCHIVADO", "INACTIVA", "BAJA"].includes(s)) return "archived";
  if (["PENDIENTE APROBACIÓN"].includes(s)) return "pending";
  if (["BORRADOR"].includes(s)) return "draft";
  if (["MEDIA"].includes(s)) return "warning";
  return "neutral";
}

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone, pulse, className }: StatusBadgeProps) {
  const t = tone ?? statusToTone(label);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        toneClasses[t],
        pulse && t === "critical" && "pulse-ring",
        className,
      )}
    >
      {label}
    </span>
  );
}
