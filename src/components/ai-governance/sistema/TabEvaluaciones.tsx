import { ExternalLink } from "lucide-react";
import type { AiRiskAssessment } from "@/hooks/useAiAssessments";
import { assessmentAcreditaConformidad } from "@/lib/aims/readiness";
import { etiqueta } from "@/lib/aims/vocabulario";

/**
 * Historial de autodiagnósticos del sistema.
 *
 * `notes` va rotulado como lo que es —texto libre de quien registró la
 * evaluación— porque hay filas en Cloud cuyo `notes` afirma «cumplimiento
 * estricto de todos los artículos» y lo escribió un e2e, no una auditoría.
 * Si acredita conformidad lo decide `assessmentAcreditaConformidad`, no esta
 * pantalla.
 */

export interface TabEvaluacionesProps {
  assessments: AiRiskAssessment[];
  onNueva: () => void;
  onAbrir: (assessmentId: string) => void;
}

export default function TabEvaluaciones({ assessments, onNueva, onAbrir }: TabEvaluacionesProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-[var(--g-text-primary)]">Historial de Autodiagnósticos de Conformidad</h2>
        <button
          type="button"
          onClick={onNueva}
          className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Nuevo Autodiagnóstico
        </button>
      </div>

      {assessments.length === 0 ? (
        <div
          className="p-8 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          No hay autodiagnósticos registrados para este sistema.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((ass) => (
            <div
              key={ass.id}
              onClick={() => onAbrir(ass.id)}
              className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 cursor-pointer hover:border-[var(--g-brand-3308)] transition-all hover:shadow-md"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{etiqueta("marco", ass.framework) || "Sin marco"}</span>
                  <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-0.5">
                    Evaluación del{" "}
                    {ass.assessment_date ? new Date(ass.assessment_date).toLocaleDateString("es-ES") : "N/D"}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-[var(--g-brand-3308)]">
                    {ass.score === null || ass.score === undefined ? "sin dato" : `${ass.score}%`}
                  </span>
                  <span className="text-[10px] text-[var(--g-text-secondary)] block">Índice Madurez</span>
                </div>
              </div>

              <div className="text-xs text-[var(--g-text-secondary)] space-y-0.5">
                <span className="block text-[10px] uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Nota libre de quien registró la evaluación
                </span>
                <p className="line-clamp-2 italic">{ass.notes || "Sin notas registradas."}</p>
              </div>

              <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
                <span
                  className={`px-2 py-0.5 font-semibold text-[11px] ${
                    assessmentAcreditaConformidad(ass.status)
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {etiqueta("estadoEvaluacion", ass.status) || "Sin estado"}
                </span>
                <span className="text-[var(--g-brand-3308)] font-semibold inline-flex items-center gap-1">
                  <span>Ver detalles</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
