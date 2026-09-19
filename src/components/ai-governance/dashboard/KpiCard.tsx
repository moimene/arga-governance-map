import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// `neutral` para el cero SIN dato: un 0 verde afirma «no hay ninguno» cuando
// en realidad no hay nada con que contarlo.
const toneColor: Record<string, string> = {
  success: "text-[var(--status-success)]",
  error:   "text-[var(--status-error)]",
  warning: "text-[var(--status-warning)]",
  info:    "text-[var(--status-info)]",
  neutral: "text-[var(--g-text-secondary)]",
};
const iconBg: Record<string, string> = {
  success: "bg-[var(--status-success)]/10",
  error:   "bg-[var(--status-error)]/10",
  warning: "bg-[var(--status-warning)]/10",
  info:    "bg-[var(--status-info)]/10",
  neutral: "bg-[var(--g-surface-muted)]",
};

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone?: "success" | "error" | "warning" | "info" | "neutral";
  to?: string;
}) {
  const navigate = useNavigate();
  const t = tone ?? "info";
  return (
    <div
      className={`bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 flex flex-col gap-3 ${to ? "cursor-pointer hover:border-[var(--g-brand-3308)] transition-colors" : ""}`}
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? "button" : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => e.key === "Enter" && navigate(to) : undefined}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center ${iconBg[t]}`} style={{ borderRadius: "var(--g-radius-md)" }}>
          <Icon className={`h-5 w-5 ${toneColor[t]}`} />
        </div>
        {to && <ArrowRight className="h-4 w-4 text-[var(--g-text-secondary)]" />}
      </div>
      <div>
        <div className={`text-2xl font-bold ${toneColor[t]}`}>{value}</div>
        <div className="text-sm font-medium text-[var(--g-text-primary)] mt-0.5">{label}</div>
        {sub && <div className="text-xs text-[var(--g-text-secondary)] mt-1">{sub}</div>}
      </div>
    </div>
  );
}
