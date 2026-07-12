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
import {
  SEMANTIC_TONE_CLASS,
  type SemanticTone,
} from "@/lib/secretaria/template-admin";

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
  const tone: SemanticTone =
    tipo === "ERROR" ? "error" : tipo === "WARNING" ? "warning" : "info";
  const Icon = tipo === "ERROR" ? AlertTriangle : tipo === "WARNING" ? AlertCircle : Info;
  return (
    <div
      className={`${SEMANTIC_TONE_CLASS[tone]} flex items-start gap-3 px-4 py-3 sm:items-center`}
      role="alert"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium flex-1">{mensaje}</span>
      {cta && "to" in cta ? (
        <a
          href={cta.to}
          className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium underline focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {cta.label}
        </a>
      ) : null}
      {cta && "onClick" in cta ? (
        <button
          type="button"
          onClick={cta.onClick}
          className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-medium underline focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {cta.label}
        </button>
      ) : null}
      {children}
    </div>
  );
}
