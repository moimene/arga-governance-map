import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  calculateAdaptationPlan,
  MATURITY_LEVELS,
  difficultyLabel,
  subpartTitle,
} from "@/lib/aims/catalog-aesia";
import { motivoNoAcredita } from "@/lib/aims/conformidad";
import { procedenciaDe } from "@/lib/aims/perfil-aplicabilidad";
import type { RequirementDef } from "@/lib/aims/catalog-aesia";
import type { FindingPintable } from "./tipos";

export interface ChecklistMedidasProps {
  catalog: RequirementDef[];
  findingsMap: Record<string, FindingPintable>;
  planCounts: Record<string, number>;
  evaluatedCount: number;
  findingsPersistidos: number;
  /** Hay findings guardados y NINGUNO casa con el catálogo del marco. */
  findingsSinReconciliar: boolean;
  expandedRequirements: Record<string, boolean>;
  onToggleRequirement: (code: string) => void;
}

/** La clase va COMPLETA en el literal: Tailwind no compone nombres en runtime. */
const KPIS: { plan: string; titulo: string; pie: string; clase: string }[] = [
  { plan: "01", titulo: "Plan 01", pie: "Doc. e Implementar", clase: "text-[var(--status-error)]" },
  { plan: "02", titulo: "Plan 02", pie: "Implementar", clase: "text-[var(--status-warning)]" },
  { plan: "03", titulo: "Plan 03", pie: "Adaptación Completa", clase: "text-[var(--status-success)]" },
  { plan: "04", titulo: "Plan 04", pie: "Documentar", clase: "text-[var(--status-info)]" },
  { plan: "05", titulo: "Plan 05", pie: "No necesaria (L8)", clase: "text-[var(--g-brand-3308)]" },
];

/** Desglose por requisito y reparto del plan de adaptación. */
export default function ChecklistMedidas({
  catalog,
  findingsMap,
  planCounts,
  evaluatedCount,
  findingsPersistidos,
  findingsSinReconciliar,
  expandedRequirements,
  onToggleRequirement,
}: ChecklistMedidasProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {KPIS.map((k, i) => (
          <div
            key={k.plan}
            className={`p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-1 ${
              i === KPIS.length - 1 ? "col-span-2 md:col-span-1" : ""
            }`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className={`text-2xl font-bold ${k.clase}`}>
              {planCounts[k.plan] ?? 0}
            </div>
            <div className="text-xs font-semibold text-[var(--g-text-primary)]">{k.titulo}</div>
            <div className="text-[10px] text-[var(--g-text-secondary)]">{k.pie}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--g-text-primary)]">
            Desglose de Requisitos y Medidas Guía (MG)
          </h2>
          <span className="text-xs text-[var(--g-text-secondary)]">
            {catalog.length} áreas normativas ({evaluatedCount} medidas evaluadas)
          </span>
        </div>

        {findingsSinReconciliar && (
          <div
            className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-warning)] flex items-start gap-3"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--g-text-primary)]">
                El desglose no corresponde a esta evaluación
              </p>
              <p className="text-xs text-[var(--g-text-secondary)]">
                La evaluación tiene {findingsPersistidos} medida(s) registradas, pero ninguna
                usa un código del catálogo de este marco: la tabla de abajo muestra el catálogo
                completo como pendiente, no el contenido real de la evaluación. El porcentaje
                de la cabecera es el valor guardado en su día, no un cálculo sobre este desglose.
              </p>
            </div>
          </div>
        )}

        {catalog.map((req) => {
          const isExpanded = expandedRequirements[req.code] ?? false;
          const reqMeasures = req.measures;
          const reqEvaluated = reqMeasures.filter((m) => !!(findingsMap[m.id] || findingsMap[m.code])).length;

          return (
            <div
              key={req.code}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <button
                onClick={() => onToggleRequirement(req.code)}
                className="w-full p-4 bg-[var(--g-surface-subtle)]/40 hover:bg-[var(--g-surface-subtle)] flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-[var(--g-brand-3308)]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[var(--g-text-secondary)]" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--g-text-primary)]">{req.title}</span>
                      <span className="text-xs font-mono text-[var(--g-brand-3308)] bg-[var(--g-surface-card)] px-2 py-0.5 border border-[var(--g-border-subtle)]" style={{ borderRadius: 'var(--g-radius-sm)' }}>
                        {req.articleRef}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">{req.description}</p>
                  </div>
                </div>

                <div className="text-xs font-semibold text-[var(--g-text-secondary)]">
                  {reqEvaluated}/{reqMeasures.length} evaluadas
                </div>
              </button>

              {/* Se OCULTA por CSS en vez de desmontarse: mientras dependía de
                  `isExpanded &&`, lo plegado no llegaba al DOM y el PDF salía
                  con las áreas colapsadas fuera del documento. */}
              <div className={`p-4 overflow-x-auto ${isExpanded ? "" : "hidden print:block"}`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
                      <th className="pb-2 font-semibold">Código</th>
                      <th className="pb-2 font-semibold">Descripción de la Medida (MG)</th>
                      <th className="pb-2 font-semibold">Bloque del requisito</th>
                      <th className="pb-2 font-semibold">Madurez</th>
                      <th className="pb-2 font-semibold">Dificultad</th>
                      <th className="pb-2 font-semibold">Plan de Adaptación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--g-border-subtle)]">
                    {reqMeasures.map((m) => {
                      const finding = findingsMap[m.id] || findingsMap[m.code];
                      const maturity = finding?.status;
                      const plan = calculateAdaptationPlan(maturity);
                      const matMeta = maturity ? MATURITY_LEVELS[maturity] : null;

                      return (
                        <tr key={m.id} className="hover:bg-[var(--g-surface-subtle)]/30 transition-colors">
                          <td className="py-2.5 font-mono text-[var(--g-brand-3308)] font-semibold">{m.id}</td>
                          <td className="py-2.5 pr-4 text-[var(--g-text-primary)]">{m.description}</td>
                          <td className="py-2.5 text-[var(--g-text-secondary)]">
                            {subpartTitle(req, m.subpartId)}
                            {(() => {
                              const proc = procedenciaDe(m.id);
                              if (!proc) return null;
                              return (
                                <div className="mt-0.5 text-[10px]">
                                  <span
                                    className={
                                      proc.caracter === "OBLIGACION"
                                        ? "font-semibold text-[var(--g-brand-3308)]"
                                        : "text-[var(--g-text-secondary)]"
                                    }
                                  >
                                    {proc.caracter === "OBLIGACION" ? "Obligación" : "Marco operativo"}
                                  </span>{" "}
                                  · {proc.norma}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-2.5">
                            {maturity ? (
                              <span
                                className={`px-2 py-0.5 font-semibold text-[11px] ${
                                  maturity === "L5"
                                    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                                    : maturity === "L8"
                                    ? "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
                                    : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                                }`}
                                style={{ borderRadius: "var(--g-radius-sm)" }}
                                title={matMeta?.description}
                              >
                                {maturity} — {matMeta?.title || maturity}
                              </span>
                            ) : (
                              <span className="text-[var(--g-text-secondary)] italic">Pendiente</span>
                            )}
                            {/* Una `L8` sin motivo no acredita no-aplicabilidad:
                                la escala declara la justificación obligatoria. Se
                                dice en la fila, que es donde se lee el nivel. */}
                            {motivoNoAcredita(finding) && (
                              <div className="mt-1 text-[10px] font-semibold text-[var(--status-error)]">
                                {motivoNoAcredita(finding)}
                              </div>
                            )}
                            {finding?.justification && (
                              <div className="mt-1 text-[10px] text-[var(--g-text-secondary)] italic max-w-md">
                                {finding.justification}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 text-[var(--g-text-secondary)]">
                            {difficultyLabel(finding?.difficulty)}
                          </td>
                          <td className="py-2.5">
                            {plan.code !== "00" ? (
                              <span
                                className={`px-2 py-0.5 font-medium text-[11px] ${
                                  plan.code === "03" || plan.code === "05"
                                    ? "text-[var(--status-success)] bg-[var(--g-surface-subtle)]"
                                    : plan.code === "01"
                                    ? "text-[var(--status-error)] bg-[var(--status-error)]/10"
                                    : "text-[var(--status-warning)] bg-[var(--status-warning)]/10"
                                }`}
                                style={{ borderRadius: "var(--g-radius-sm)" }}
                              >
                                {plan.label}
                              </span>
                            ) : (
                              <span className="text-[var(--g-text-secondary)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
