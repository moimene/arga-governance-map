/**
 * AlertBanner reutilizable para la consola del Gestor de Plantillas.
 *
 * Soporta tres severidades (ERROR / WARNING / INFO) y un CTA opcional
 * (enlace o callback). Tokens Garrigues exclusivamente.
 *
 * Sprint 1 — Task 5.1 Step 2.
 */
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { ReactNode } from "react";

export type AlertSeverity = "ERROR" | "WARNING" | "INFO";

type AlertCtaLink = { label: string; to: string };
type AlertCtaButton = { label: string; onClick: () => void };
export type AlertCta = AlertCtaLink | AlertCtaButton;

export interface AlertBannerProps {
  tipo: AlertSeverity;
  mensaje: string;
  cta?: AlertCta;
  children?: ReactNode;
}

export function AlertBanner({ tipo, mensaje, cta, children }: AlertBannerProps) {
  const bgColor =
    tipo === "ERROR"
      ? "bg-[var(--status-error)]"
      : tipo === "WARNING"
        ? "bg-[var(--status-warning)]"
        : "bg-[var(--status-info)]";
  const Icon = tipo === "ERROR" ? AlertTriangle : tipo === "WARNING" ? AlertCircle : Info;
  return (
    <div
      className={`${bgColor} flex items-center gap-3 px-4 py-3 text-[var(--g-text-inverse)]`}
      role="alert"
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium flex-1">{mensaje}</span>
      {cta && "to" in cta ? (
        <a href={cta.to} className="text-sm underline font-medium">
          {cta.label}
        </a>
      ) : null}
      {cta && "onClick" in cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className="text-sm underline font-medium"
        >
          {cta.label}
        </button>
      ) : null}
      {children}
    </div>
  );
}
