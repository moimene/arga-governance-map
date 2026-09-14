import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { formatIncidentDate, GRAVEDAD_RIA, type RiaIncidentSeverity } from "@/lib/aims/incident-clocks";
import type { AiIncident } from "@/hooks/useAiIncidents";
import { ESTADOS_INCIDENTE, etiqueta } from "@/lib/aims/vocabulario";

export interface EdicionIncidenteProps {
  incident: AiIncident;
  isEditing: boolean;
  /** Lo que se está viendo: el borrador si se edita, el dato si no. */
  currentStatus: string;
  currentSeverity: string;
  currentRootCause: string;
  currentCorrectiveAction: string;
  /** Borrador de edición: vive en la página, aquí sólo se pinta. */
  status: string;
  setStatus: (v: string) => void;
  rootCause: string;
  setRootCause: (v: string) => void;
  correctiveAction: string;
  setCorrectiveAction: (v: string) => void;
  /** `""` = no declarado; viaja como NULL. */
  riaSeverity: RiaIncidentSeverity | "";
  setRiaSeverity: (v: RiaIncidentSeverity | "") => void;
}

const TEXTAREA_CLASSES =
  "w-full p-3 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]";

/** Descripción, RCA, medidas correctoras y control de ciclo de vida. */
export default function EdicionIncidente({
  incident,
  isEditing,
  currentStatus,
  currentSeverity,
  currentRootCause,
  currentCorrectiveAction,
  status,
  setStatus,
  rootCause,
  setRootCause,
  correctiveAction,
  setCorrectiveAction,
  riaSeverity,
  setRiaSeverity,
}: EdicionIncidenteProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">Descripción del Incidente</h2>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)] whitespace-pre-wrap leading-relaxed">
            {incident.description || "Sin descripción registrada."}
          </p>
        </div>

        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">Análisis de Causa Raíz (RCA)</h2>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <label htmlFor="incidente-causa-raiz" className="text-xs font-semibold text-[var(--g-text-primary)]">
                Causa Raíz Identificada
              </label>
              <textarea
                id="incidente-causa-raiz"
                rows={4}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="Detallar la causa técnica o metodológica (drift no detectado, dataset sesgado, fallo de pipeline, etc.)..."
                className={TEXTAREA_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--g-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {currentRootCause || "Pendiente de determinación por el equipo de investigación técnica."}
            </p>
          )}
        </div>

        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[var(--status-success)]" />
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              Medidas Correctoras y Plan de Remediación
            </h2>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <label htmlFor="incidente-accion-correctiva" className="text-xs font-semibold text-[var(--g-text-primary)]">
                Acciones Correctivas Implementadas o Previstas
              </label>
              <textarea
                id="incidente-accion-correctiva"
                rows={4}
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="Detallar acciones inmediatas y preventivas (reentrenamiento, threshold tuning, actualización de guardrails, auditoría)..."
                className={TEXTAREA_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--g-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {currentCorrectiveAction || "No se han documentado medidas correctoras definitivas todavía."}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h3 className="text-sm font-bold text-[var(--g-text-primary)] uppercase tracking-wider">
            Control de Ciclo de Vida
          </h3>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="incidente-estado" className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Estado del Incidente
                </label>
                <select
                  id="incidente-estado"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2.5 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {ESTADOS_INCIDENTE.map((v) => (
                    <option key={v} value={v}>{etiqueta("estadoIncidente", v)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="incidente-tipologia-ria" className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Tipología del art. 73
                </label>
                <select
                  id="incidente-tipologia-ria"
                  value={riaSeverity}
                  onChange={(e) => setRiaSeverity(e.target.value as RiaIncidentSeverity | "")}
                  className="w-full p-2.5 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {GRAVEDAD_RIA.map((g) => (
                    <option key={g.code} value={g.code}>{g.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                  Recalcula el plazo del art. 73 y se guarda con el incidente al pulsar Guardar.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-[var(--g-text-secondary)]">
              <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                <span>Estado:</span>
                <span className="font-semibold text-[var(--g-text-primary)]">{etiqueta("estadoIncidente", currentStatus)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                <span>Severidad:</span>
                <span className="font-semibold text-[var(--g-text-primary)]">{etiqueta("severidad", currentSeverity)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                <span>Tipología art. 73:</span>
                <span className="font-semibold text-[var(--g-text-primary)]">
                  {GRAVEDAD_RIA.find((g) => g.code === (incident.ria_severity ?? ""))?.label ?? "No declarada"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                <span>Fecha de conocimiento:</span>
                <span className="font-semibold text-[var(--g-text-primary)]">
                  {incident.knowledge_at
                    ? formatIncidentDate(incident.knowledge_at)
                    : `${formatIncidentDate(incident.reported_at)} (no declarada; se usa la de registro)`}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Fecha Cierre:</span>
                <span className="font-semibold text-[var(--g-text-primary)]">
                  {incident.closed_at ? formatIncidentDate(incident.closed_at) : "Abierto"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
