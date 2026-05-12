/**
 * KpiCard reutilizable para la consola del Gestor de Plantillas.
 * Extraído de PlantillasTracker.tsx y promovido a componente standalone.
 *
 * Sprint 1 — Task 5.1.
 */
import { type ElementType } from "react";
import { TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";

export type KpiTone = "primary" | "success" | "warning" | "neutral";

export interface KpiCardProps {
  label: string;
  value: string | number;
  tone?: KpiTone;
  sublabel?: string;
  icon?: ElementType;
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  tone = "primary",
  sublabel,
  icon,
  onClick,
}: KpiCardProps) {
  const iconColor =
    tone === "warning"
      ? "text-[var(--status-warning)]"
      : tone === "success"
        ? "text-[var(--status-success)]"
        : tone === "neutral"
          ? "text-[var(--g-text-secondary)]"
          : "text-[var(--g-brand-3308)]";

  const Icon =
    icon ??
    (tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : TrendingUp);

  const interactive = !!onClick;
  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={`text-left w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 ${
        interactive ? "transition-all hover:border-[var(--g-brand-3308)] cursor-pointer" : ""
      }`}
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-widest text-[var(--g-text-secondary)]">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="text-3xl font-bold text-[var(--g-text-primary)] mb-1">{value}</div>
      {sublabel ? (
        <div className="text-xs text-[var(--g-text-secondary)]">{sublabel}</div>
      ) : null}
    </Tag>
  );
}
