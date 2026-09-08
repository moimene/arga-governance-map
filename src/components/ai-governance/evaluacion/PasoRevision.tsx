/**
 * Paso 3 — consolidación, plan de adaptación y notas.
 *
 * Las estadísticas y el plan llegan YA calculados (`computeAssessmentStats`,
 * `generarPlanDeAdaptacion`): aquí no se deriva ningún criterio, se pinta y se
 * edita lo editable —responsable y fecha—, que es lo único que el plan admite
 * a mano.
 */
import { AlertTriangle, Save } from "lucide-react";
import { ADAPTATION_PLANS } from "@/lib/aims/catalog-aesia";
import type { AccionPDA } from "@/lib/aims/plan-adaptacion";
import { LABEL_CLASSES, TEXTAREA_CLASSES } from "./ControlesDeMedida";

export type EstadisticasEvaluacion = {
  maturityScore: number;
  planCounts: Record<string, number>;
  gapMeasures: unknown[];
};

export type PasoRevisionProps = {
  stats: EstadisticasEvaluacion;
  plan: AccionPDA[];
  personas: { id: string; full_name: string }[];
  notes: string;
  onNotesChange: (notes: string) => void;
  onEditarAccion: (measureCode: string, cambio: Partial<AccionPDA>) => void;
  guardando: boolean;
  onPrev: () => void;
  onSubmit: () => void;
};

export default function PasoRevision({
  stats,
  plan,
  personas,
  notes,
  onNotesChange,
  onEditarAccion,
  guardando,
  onPrev,
  onSubmit,
}: PasoRevisionProps) {
  return (
    <div className="space-y-6">
      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--g-text-primary)]">
              3. Consolidación y Plan de Adaptación (PDA)
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Resumen de diagnóstico generado con las reglas de conversión del catálogo de medidas.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[var(--g-brand-3308)]">{stats.maturityScore}%</div>
            <div className="text-xs text-[var(--g-text-secondary)] font-semibold">Índice de Madurez RIA</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(ADAPTATION_PLANS).map(([code, planDef]) => (
            <div
              key={code}
              className="p-4 bg-[var(--g-surface-subtle)]/50 border border-[var(--g-border-subtle)] text-center space-y-1"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div
                className={`text-2xl font-bold ${
                  code === "03" || code === "05"
                    ? "text-[var(--status-success)]"
                    : code === "01"
                    ? "text-[var(--status-error)]"
                    : "text-[var(--status-warning)]"
                }`}
              >
                {stats.planCounts[code] || 0}
              </div>
              <div className="text-xs font-bold text-[var(--g-text-primary)]">Plan {code}</div>
              <div className="text-[10px] text-[var(--g-text-secondary)]">{planDef.action}</div>
            </div>
          ))}
        </div>

        {stats.gapMeasures.length > 0 && (
          <div
            className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-warning)] space-y-2 text-xs"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex items-center gap-2 font-bold text-[var(--g-text-primary)]">
              <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
              <span>Detección Automática de Brechas (GAPs)</span>
            </div>
            <p className="text-[var(--g-text-secondary)] leading-relaxed">
              Se han detectado {stats.gapMeasures.length} medidas con necesidad de adaptación (Plan 01 o Plan 04).
              Al registrar la evaluación, se habilitará la derivación del expediente técnico hacia GRC Compass para
              la formulación de planes de remediación.
            </p>
          </div>
        )}

        {/* El plan como ACCIONES. En el primer piloto vivía entero dentro de
            `notes`: seis acciones con responsable, prioridad y fecha escritas a
            mano en un párrafo, que no se puede filtrar ni ordenar ni vencer. */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className={LABEL_CLASSES}>Plan de Adaptación ({plan.length} acciones)</label>
            <span className="text-xs text-[var(--g-text-secondary)]">
              Una acción por medida con brecha. La prioridad sale del plan y de la dificultad;
              la fecha es una propuesta editable.
            </span>
          </div>
          {plan.length === 0 ? (
            <p className="text-xs text-[var(--g-text-secondary)] italic">
              Ninguna medida evaluada exige acción todavía.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
                    <th className="pb-2 pr-3 font-semibold">Medida</th>
                    <th className="pb-2 pr-3 font-semibold">Acción</th>
                    <th className="pb-2 pr-3 font-semibold">Prioridad</th>
                    <th className="pb-2 pr-3 font-semibold">Responsable</th>
                    <th className="pb-2 pr-3 font-semibold">Vence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {plan.map((a) => (
                    <tr key={a.measureCode}>
                      <td className="py-2 pr-3 font-mono text-[var(--g-brand-3308)] font-semibold align-top">
                        {a.measureCode}
                      </td>
                      <td className="py-2 pr-3 text-[var(--g-text-primary)] align-top max-w-sm">
                        {a.titulo}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold ${
                            a.prioridad === "ALTA"
                              ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                              : a.prioridad === "MEDIA"
                              ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                              : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-full)" }}
                        >
                          {a.prioridad}
                        </span>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <select
                          value={a.owner_id ?? ""}
                          onChange={(e) => onEditarAccion(a.measureCode, { owner_id: e.target.value || null })}
                          className="h-8 w-40 px-2 text-xs border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                          aria-label={`Responsable de ${a.measureCode}`}
                        >
                          <option value="">Sin asignar</option>
                          {personas.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <input
                          type="date"
                          value={a.vence_el ?? ""}
                          onChange={(e) => onEditarAccion(a.measureCode, { vence_el: e.target.value || null })}
                          className="h-8 px-2 text-xs border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                          aria-label={`Vencimiento de ${a.measureCode}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className={LABEL_CLASSES}>Notas y Observaciones de la Evaluación</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Observaciones técnicas o conclusiones del equipo evaluador..."
            className={TEXTAREA_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[var(--g-border-subtle)]">
          <button
            type="button"
            onClick={onPrev}
            className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={guardando}
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Save className="w-4 h-4" />
            <span>{guardando ? "Registrando..." : "Guardar autodiagnóstico"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
