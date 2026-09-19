import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ClipboardCheck, Cpu, Route } from "lucide-react";
import type { AimsPaso } from "@/lib/aims/readiness";

export interface PrioridadAhoraProps {
  altosNoEvaluados: number;
  materialIncidents: number;
  activos: number;
  totalSistemas: number;
  totalIncidentes: number;
  /** «N en inventario · M en evaluación», ya compuesto por la página. */
  detalleInventario: string;
  /** Con cuestionario de clasificación completado (`tieneClasificacionGuiada`). */
  conClasificacionGuiada: number;
  /** Ningún «Alto» contado viene de un cuestionario: el nivel es el declarado en ficha y se pinta neutro. */
  nivelDeclarado: boolean;
  /** Siguientes pasos derivados del dato (`readiness.nextSteps`), no una lista fija. */
  pasos: AimsPaso[];
  loading: boolean;
}

export function PrioridadAhora({
  altosNoEvaluados,
  materialIncidents,
  activos,
  totalSistemas,
  totalIncidentes,
  detalleInventario,
  conClasificacionGuiada,
  nivelDeclarado,
  pasos,
  loading,
}: PrioridadAhoraProps) {
  const priorityItems = [
    {
      label: "Alto riesgo sin autodiagnóstico acreditado",
      value: altosNoEvaluados,
      body: nivelDeclarado
        ? "El «Alto» es el declarado en ficha: clasificar con el cuestionario antes de concluir."
        : "Congelar y revisar el autodiagnóstico antes de presentar el sistema como controlado.",
      to: "/ai-governance/evaluaciones",
      icon: ClipboardCheck,
      // Neutro sin cuestionario: un nivel declarado en ficha no es un riesgo medido.
      tone:
        totalSistemas === 0 || nivelDeclarado
          ? "text-[var(--g-text-secondary)]"
          : altosNoEvaluados > 0
            ? "text-[var(--status-error)]"
            : "text-[var(--status-success)]",
    },
    {
      label: "Incidentes materiales de IA",
      value: materialIncidents,
      body: "Revisar severidad, causa raíz y posible derivación a GRC o Secretaría.",
      to: "/ai-governance/incidentes",
      icon: AlertTriangle,
      // Con cero incidentes registrados el cero no es bueno ni malo: no consta.
      tone:
        materialIncidents > 0
          ? "text-[var(--status-warning)]"
          : totalIncidentes === 0
            ? "text-[var(--g-text-secondary)]"
            : "text-[var(--status-success)]",
    },
    {
      label: "Inventario activo",
      value: activos,
      // Antes afirmaba que los N sistemas tenían clasificación de riesgo sin
      // mirarla. Se cuenta con el criterio único: cuestionario completado.
      body:
        totalSistemas === 0
          ? "Sin sistemas registrados en el inventario."
          : `${detalleInventario}; ${conClasificacionGuiada} con clasificación guiada.`,
      to: "/ai-governance/sistemas",
      icon: Cpu,
      tone: totalSistemas === 0 ? "text-[var(--g-text-secondary)]" : "text-[var(--status-info)]",
    },
  ];

  return (
    <section className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
      <div
        className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
            Prioridad ahora
          </p>
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Sistemas, evaluaciones e incidentes que requieren criterio
          </h2>
        </div>
        <div className="divide-y divide-[var(--g-border-subtle)]">
          {priorityItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className="flex min-h-[92px] items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</span>
                    <span className={`text-sm font-bold tabular-nums ${item.tone}`}>{loading ? "..." : item.value}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--g-text-secondary)]">{item.body}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
              </Link>
            );
          })}
        </div>
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
            Siguientes pasos, derivados del dato
          </p>
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Acciones del responsable AIMS
          </h2>
        </div>
        {pasos.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">Sin pasos derivados del dato disponible.</p>
        ) : (
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {pasos.map((paso) => (
              <Link
                key={paso.label}
                to={paso.to}
                className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              >
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--g-text-primary)]">{paso.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--g-text-secondary)]">{paso.detalle}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
