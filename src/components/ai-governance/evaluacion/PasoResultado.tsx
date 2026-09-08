/**
 * Paso 4 — qué queda registrado, dicho sin promesas.
 *
 * No hay precinto: son dos INSERT planos, en `ai_risk_assessments` y en
 * `ai_compliance_checks`. Sin hash, sin sello y sin bundle de evidencia. El
 * rótulo anterior prometía un precinto, es decir una integridad que el producto
 * no calcula ni guarda.
 */
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { EstadisticasEvaluacion } from "./PasoRevision";

export type PasoResultadoProps = {
  stats: EstadisticasEvaluacion & { diagnosedCount: number };
  createdId: string | null;
};

export default function PasoResultado({ stats, createdId }: PasoResultadoProps) {
  return (
    <div
      className="p-8 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-6 max-w-2xl mx-auto"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div
        className="w-16 h-16 bg-[var(--status-success)] text-[var(--g-text-inverse)] flex items-center justify-center mx-auto"
        style={{ borderRadius: "var(--g-radius-full)" }}
      >
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-[var(--g-text-primary)]">
          Autodiagnóstico Registrado con Éxito
        </h2>
        <p className="text-sm text-[var(--g-text-secondary)]">
          La evaluación queda registrada y es editable: no lleva hash de integridad,
          sello ni bundle de evidencia, y su registro no acredita conformidad por sí solo.
        </p>
      </div>

      <div
        className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] text-xs grid grid-cols-3 gap-2"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div>
          <span className="text-[var(--g-text-secondary)] block">Índice Madurez:</span>
          <span className="font-bold text-lg text-[var(--g-brand-3308)]">{stats.maturityScore}%</span>
        </div>
        <div>
          <span className="text-[var(--g-text-secondary)] block">Medidas Evaluadas:</span>
          <span className="font-bold text-lg text-[var(--g-text-primary)]">{stats.diagnosedCount}</span>
        </div>
        <div>
          <span className="text-[var(--g-text-secondary)] block">Planes Activos:</span>
          <span className="font-bold text-lg text-[var(--status-warning)]">
            {stats.planCounts["01"] + stats.planCounts["02"]}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        {createdId && (
          <Link
            to={`/ai-governance/evaluaciones/${createdId}`}
            className="px-5 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors inline-flex items-center gap-1.5"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <span>Inspeccionar Informe Completo</span>
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
        <Link
          to="/ai-governance/evaluaciones"
          className="px-5 py-2.5 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Volver al Listado
        </Link>
      </div>
    </div>
  );
}

function CheckCircle2(props: { className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
