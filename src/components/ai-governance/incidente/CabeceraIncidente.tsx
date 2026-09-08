import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, Save, ShieldAlert } from "lucide-react";
import { formatIncidentDate } from "@/lib/aims/incident-clocks";
import { etiqueta, normalizeAimsStatus } from "@/lib/aims/vocabulario";
import type { AiIncident } from "@/hooks/useAiIncidents";

export interface CabeceraIncidenteProps {
  incident: AiIncident;
  isEditing: boolean;
  isSaving: boolean;
  currentStatus: string;
  currentSeverity: string;
  /** Resuelto en la página con `isMaterialSeverity`: aquí no se decide nada. */
  isMaterial: boolean;
  /** Los relojes que se están contando DE VERDAD, para no anunciar de más. */
  regimenesEnCurso: string[];
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

/** Barra superior, identificación del expediente y escalados. */
export default function CabeceraIncidente({
  incident,
  isEditing,
  isSaving,
  currentStatus,
  currentSeverity,
  isMaterial,
  regimenesEnCurso,
  onStartEdit,
  onCancelEdit,
  onSave,
}: CabeceraIncidenteProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate("/ai-governance/incidentes")}
          className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Registro de Incidentes</span>
        </button>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              onClick={onStartEdit}
              className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Gestionar / Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onCancelEdit}
                className="px-3 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              <span className="font-mono">EXP-INC-{incident.id.slice(0, 8).toUpperCase()}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Reportado: {formatIncidentDate(incident.reported_at)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">{incident.title}</h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Sistema afectado:{" "}
              {incident.system_id ? (
                <Link
                  to={`/ai-governance/sistemas/${incident.system_id}`}
                  className="font-semibold text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-1"
                >
                  {incident.ai_systems?.name || "Ver sistema IA"}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <span className="italic">No asignado</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                normalizeAimsStatus(currentStatus) === "CERRADO"
                  ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  : normalizeAimsStatus(currentStatus) === "EN_INVESTIGACION"
                  ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {etiqueta("estadoIncidente", currentStatus) || currentStatus}
            </span>

            {/* Mismo predicado que el banner de dos bloques más abajo. Antes eran
                dos criterios distintos sobre el mismo dato: el banner acertaba
                con `isMaterialSeverity` y el chip comparaba con 'CRITICA'/'ALTA',
                grafías que ningún camino de escritura produce (el alta y la
                lista escriben 'CRITICO'/'ALTO'). Se pierde a propósito el matiz
                crítico/alto en el color —lo dice el literal— a cambio de que las
                dos superficies no puedan volver a discrepar. */}
            <span
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                isMaterial
                  ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              Severidad: {currentSeverity || "sin registrar"}
            </span>
          </div>
        </div>

        {isMaterial && (
          <div
            className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-error)] flex flex-wrap items-center justify-between gap-3"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-[var(--status-error)] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[var(--g-text-primary)]">
                  Incidente de severidad material
                </p>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  {/* Se nombra sólo lo que sí se cuenta: la aplicabilidad de cada
                      régimen se declara en el alta, y lo no declarado no se
                      presume ni en un sentido ni en el otro. */}
                  {regimenesEnCurso.length > 0
                    ? `Plazo en curso: ${regimenesEnCurso.join(" · ")}. Los demás regímenes no se cuentan porque su aplicabilidad no consta declarada.`
                    : "No hay ningún plazo regulatorio en curso: la aplicabilidad de cada régimen no consta declarada."}{" "}
                  Escalado recomendado a Secretaría y comités de control.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${incident.id}`}
                className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span>Handoff GRC</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                to={`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${incident.id}`}
                className="px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span>Punto Orden del Día</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
