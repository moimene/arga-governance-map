/**
 * Paso 1 — sistema de IA y marco normativo contra el que se autodiagnostica.
 *
 * Los marcos llegan por props: quién decide el catálogo es la página (es la
 * que resuelve el perfil de aplicabilidad), no el paso que lo pinta.
 */
import { ArrowRight } from "lucide-react";
import type { AiSystem } from "@/hooks/useAiSystems";
import { LABEL_CLASSES, SELECT_CLASSES } from "./estado-medida";

export type MarcoEvaluacion = "EU_AI_ACT" | "ISO_42001";

export type PasoParametrosProps = {
  systems: AiSystem[];
  systemId: string;
  onSystemIdChange: (id: string) => void;
  framework: MarcoEvaluacion;
  onFrameworkChange: (framework: MarcoEvaluacion) => void;
  marcos: { value: MarcoEvaluacion; label: string }[];
  selectedSystem?: AiSystem;
  onNext: () => void;
};

export default function PasoParametros({
  systems,
  systemId,
  onSystemIdChange,
  framework,
  onFrameworkChange,
  marcos,
  selectedSystem,
  onNext,
}: PasoParametrosProps) {
  return (
    <div
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-6"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="border-b border-[var(--g-border-subtle)] pb-3">
        <h2 className="text-base font-bold text-[var(--g-text-primary)]">
          1. Parámetros del Autodiagnóstico
        </h2>
        <p className="text-xs text-[var(--g-text-secondary)]">
          Selecciona el sistema de IA y el estándar de cumplimiento contra el que se verificará el expediente técnico.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className={LABEL_CLASSES} htmlFor="eval-system">Sistema de IA Objetivo *</label>
          <select
            id="eval-system"
            value={systemId}
            onChange={(e) => onSystemIdChange(e.target.value)}
            className={SELECT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Seleccione un sistema de IA...</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.risk_level || "Riesgo N/D"} • {s.system_type || "ML"})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASSES} htmlFor="eval-framework">Marco Normativo *</label>
          <select
            id="eval-framework"
            value={framework}
            onChange={(e) => onFrameworkChange(e.target.value as MarcoEvaluacion)}
            className={SELECT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {marcos.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedSystem && (
        <div
          className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] space-y-2 text-xs"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="font-bold text-[var(--g-brand-3308)]">Ficha Técnica Seleccionada:</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[var(--g-text-primary)]">
            <div>
              <span className="text-[var(--g-text-secondary)]">Tipo:</span> {selectedSystem.system_type}
            </div>
            <div>
              <span className="text-[var(--g-text-secondary)]">Nivel de Riesgo:</span>{" "}
              <span className="font-bold">{selectedSystem.risk_level}</span>
            </div>
            <div>
              <span className="text-[var(--g-text-secondary)]">Proveedor:</span> {selectedSystem.vendor || "No declarado"}
            </div>
            <div>
              <span className="text-[var(--g-text-secondary)]">Estado:</span> {selectedSystem.status}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span>Continuar a Evaluación de Medidas</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
