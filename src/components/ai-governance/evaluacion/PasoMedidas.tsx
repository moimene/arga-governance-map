/**
 * Paso 2 — evaluación medida a medida del catálogo aplicable.
 *
 * El catálogo YA viene decidido (`requirements`): quién lo elige es la página,
 * a través del perfil de aplicabilidad. Este paso no vuelve a resolverlo ni
 * conoce las 84 medidas del proveedor; pinta lo que recibe.
 */
import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, Info, Save } from "lucide-react";
import type { AimsEvidenceItem } from "@/hooks/useAimsEvidence";
import {
  subpartTitle,
  calculateAdaptationPlan,
  type RequirementDef,
} from "@/lib/aims/catalog-aesia";
import { MOTIVO_L5_SIN_EVIDENCIA, type MedidaAdicionalRef } from "@/lib/aims/evaluacion-payload";
import { procedenciaDe } from "@/lib/aims/perfil-aplicabilidad";
import EvidenciaDeMedida from "@/components/ai-governance/EvidenciaDeMedida";
import ControlesDeMedida, {
  BadgePlan,
  ESTADO_VACIO,
  type MeasureEvaluationState,
} from "./ControlesDeMedida";
import { BotonNuevaMedidaAdicional, ListaMedidasAdicionales } from "./MedidasAdicionales";

export type EstadoAutoguardado = "limpio" | "guardando" | "guardado" | "error";

export type PasoMedidasProps = {
  requirements: RequirementDef[];
  activeRequirement: RequirementDef;
  activeReqCode: string;
  onActiveReqCode: (code: string) => void;
  additionalMeasures: MedidaAdicionalRef[];
  evaluations: Record<string, MeasureEvaluationState>;
  onEvaluationChange: (measureId: string, key: keyof MeasureEvaluationState, value: string) => void;
  onAddMa: (descripcion: string, subpartId: string) => void;
  onRemoveMa: (measureId: string) => void;
  systemId: string;
  evidencias: AimsEvidenceItem[];
  evidenciasDe: Record<string, AimsEvidenceItem[]>;
  autoguardado: EstadoAutoguardado;
  /** El banner de perfil, resuelto por la página. */
  bannerPerfil: ReactNode;
  onPrev: () => void;
  onNext: () => void;
};

function AvisoAutoguardado({ estado }: { estado: EstadoAutoguardado }) {
  // El estado del borrador se dice: un autoguardado silencioso da confianza
  // para cerrar la pestaña sin saber si guardó.
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
      aria-live="polite"
    >
      {estado === "error" ? (
        <>
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-error)]" />
          <span className="text-[var(--status-error)]">Borrador NO guardado</span>
        </>
      ) : estado === "guardando" ? (
        <>
          <Save className="w-3.5 h-3.5 text-[var(--g-text-secondary)]" />
          <span className="text-[var(--g-text-secondary)]">Guardando borrador…</span>
        </>
      ) : estado === "guardado" ? (
        <>
          <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
          <span className="text-[var(--g-text-primary)]">Borrador guardado</span>
        </>
      ) : (
        <>
          <Info className="w-3.5 h-3.5 text-[var(--g-text-secondary)]" />
          <span className="text-[var(--g-text-secondary)]">
            El trabajo se guarda solo como borrador
          </span>
        </>
      )}
    </div>
  );
}

export default function PasoMedidas({
  requirements,
  activeRequirement,
  activeReqCode,
  onActiveReqCode,
  additionalMeasures,
  evaluations,
  onEvaluationChange,
  onAddMa,
  onRemoveMa,
  systemId,
  evidencias,
  evidenciasDe,
  autoguardado,
  bannerPerfil,
  onPrev,
  onNext,
}: PasoMedidasProps) {
  return (
    <div className="space-y-6">
      <div
        className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-[var(--g-brand-3308)] uppercase tracking-wider">
            Autoevaluación granular por medida
          </span>
          <p className="text-xs text-[var(--g-text-secondary)]">
            Evalúa el nivel de madurez (L1 a L8) y la dificultad de cada medida del catálogo.
          </p>
        </div>
        <AvisoAutoguardado estado={autoguardado} />
      </div>

      {bannerPerfil}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Requisitos del catálogo aplicado */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-[var(--g-text-secondary)] px-2 uppercase tracking-wider">
            Requisitos RIA ({requirements.length})
          </span>
          <div className="space-y-1">
            {requirements.map((r) => {
              const isActive = r.code === activeReqCode;
              // Las MA del requisito entran en el contador: si no, se leía
              // «11/11» con una medida adicional sin contestar debajo.
              const reqMeasures = [
                ...r.measures.map((m) => m.id),
                ...additionalMeasures.filter((ma) => ma.requirementCode === r.code).map((ma) => ma.id),
              ];
              const diagnosedInReq = reqMeasures.filter((id) => !!evaluations[id]?.maturity).length;

              return (
                <button
                  key={r.code}
                  onClick={() => onActiveReqCode(r.code)}
                  className={`w-full p-2.5 text-left text-xs transition-colors flex items-center justify-between ${
                    isActive
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] font-bold shadow-sm"
                      : "bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <div className="truncate font-semibold">{r.title}</div>
                    <div className={`text-[10px] ${isActive ? "text-[var(--g-text-inverse)]/80" : "text-[var(--g-text-secondary)]"}`}>
                      {r.articleRef}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 font-mono ${
                      isActive
                        ? "bg-[var(--g-surface-card)]/20 text-[var(--g-text-inverse)]"
                        : "bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {diagnosedInReq}/{reqMeasures.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          <div
            className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--g-border-subtle)] pb-3">
              <div>
                <span className="text-xs font-mono text-[var(--g-brand-3308)] font-bold bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {/* El marco depende del requisito: los del RIA citan un
                      artículo del Reglamento; los de ISO 42001 citan un anexo
                      de la norma. Poner el Reglamento fijo atribuía a la norma
                      europea un anexo que no es suyo. */}
                  {activeRequirement.articleRef}
                  {activeRequirement.articleRef.startsWith("Art.") ? " Reglamento (UE) 2024/1689" : ""}
                </span>
                <h2 className="text-lg font-bold text-[var(--g-text-primary)] mt-1">
                  {activeRequirement.title}
                </h2>
              </div>
              <BotonNuevaMedidaAdicional requirement={activeRequirement} onAdd={onAddMa} />
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
              {activeRequirement.description}
            </p>
          </div>

          <div className="space-y-4">
            {activeRequirement.measures.map((m) => {
              const state = evaluations[m.id] || ESTADO_VACIO;
              const plan = calculateAdaptationPlan(state.maturity);
              const proc = procedenciaDe(m.id);

              return (
                <div
                  key={m.id}
                  className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4 transition-all hover:border-[var(--g-brand-3308)]/50"
                  style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                          {m.id}
                        </span>
                        <span className="text-xs text-[var(--g-text-secondary)]">
                          {subpartTitle(activeRequirement, m.subpartId)}
                        </span>
                        {/* «Obligación» y «marco operativo» no son lo mismo, y
                            presentar un control de ISO 42001 como deber
                            jurídico sería fabricar una obligación. */}
                        {proc && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold ${
                              proc.caracter === "OBLIGACION"
                                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                                : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                            }`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                            title={
                              proc.caracter === "OBLIGACION"
                                ? `Obligación — ${proc.norma}`
                                : `Marco operativo de madurez, no obligación jurídica autónoma — ${proc.norma}`
                            }
                          >
                            {proc.caracter === "OBLIGACION" ? "Obligación" : "Marco operativo"} ·{" "}
                            {proc.norma}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{m.description}</h3>
                    </div>

                    <div className="text-right">
                      <BadgePlan code={plan.code} label={plan.label} />
                    </div>
                  </div>

                  <ControlesDeMedida
                    state={state}
                    onChange={(key, value) => onEvaluationChange(m.id, key, value)}
                  />
                  {systemId && (
                    <EvidenciaDeMedida
                      systemId={systemId}
                      measureId={m.id}
                      vinculadas={evidenciasDe[m.id] ?? []}
                      delSistema={evidencias}
                    />
                  )}
                  {/* `L5` sin nada detrás es una autodeclaración: se dice en la
                      propia medida y no suma al porcentaje. */}
                  {state.maturity === "L5" && (evidenciasDe[m.id] ?? []).length === 0 && (
                    <p className="text-[11px] font-semibold text-[var(--status-warning)]">
                      {MOTIVO_L5_SIN_EVIDENCIA}: no computa como acreditada.
                    </p>
                  )}
                </div>
              );
            })}

            <ListaMedidasAdicionales
              requirement={activeRequirement}
              medidas={additionalMeasures.filter((ma) => ma.requirementCode === activeReqCode)}
              evaluations={evaluations}
              onEvaluationChange={onEvaluationChange}
              onRemove={onRemoveMa}
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
              onClick={onNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span>Revisar Plan de Adaptación (PDA)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
