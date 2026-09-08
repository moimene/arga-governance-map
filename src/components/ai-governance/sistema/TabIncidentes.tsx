import { ExternalLink } from "lucide-react";
import type { AiIncident } from "@/hooks/useAiIncidents";
import { isMaterialSeverity } from "@/lib/aims/readiness";
import { etiqueta } from "@/lib/aims/vocabulario";

/**
 * Incidentes registrados del sistema. Qué severidad es material lo decide
 * `isMaterialSeverity`, no una comparación literal de esta pantalla: la ficha
 * comparaba con grafías que nadie escribe y el aviso nunca se encendía.
 */

export interface TabIncidentesProps {
  incidents: AiIncident[];
  onNuevo: () => void;
  onAbrir: (incidentId: string) => void;
}

export default function TabIncidentes({ incidents, onNuevo, onAbrir }: TabIncidentesProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-[var(--g-text-primary)]">Registro de Incidentes de IA (Art. 73 RIA)</h2>
        <button
          type="button"
          onClick={onNuevo}
          className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Reportar Incidente
        </button>
      </div>

      {incidents.length === 0 ? (
        <div
          className="p-8 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          No se han registrado incidentes operativos para este sistema.
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => onAbrir(inc.id)}
              className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:border-[var(--g-brand-3308)] transition-all hover:shadow-sm"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--g-text-secondary)]">EXP-INC-{inc.id.slice(0, 6)}</span>
                  <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{inc.title}</h3>
                </div>
                <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">{inc.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 text-xs font-semibold ${
                    isMaterialSeverity(inc.severity)
                      ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {etiqueta("severidad", inc.severity) || "Sin severidad"}
                </span>
                <span className="text-xs font-bold text-[var(--g-text-primary)]">{etiqueta("estadoIncidente", inc.status) || "Sin estado"}</span>
                <ExternalLink className="w-4 h-4 text-[var(--g-text-secondary)]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
