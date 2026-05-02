import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, PlusCircle, Route } from "lucide-react";
import { useAiIncidentsList } from "@/hooks/useAiIncidents";
import { isAimsMaterialIncidentCandidate } from "@/lib/aims/readiness";

const SEVERITY_CHIP: Record<string, string> = {
  CRITICO: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  ALTO:    "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  MEDIO:   "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BAJO:    "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
};

const STATUS_CHIP: Record<string, string> = {
  ABIERTO:          "bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/30",
  EN_INVESTIGACION: "bg-[var(--status-warning)]/10 text-[var(--g-text-secondary)] border border-[var(--status-warning)]/30",
  CERRADO:          "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/30",
};

export default function AiIncidentes() {
  const navigate = useNavigate();
  const { data: incidents = [], isLoading } = useAiIncidentsList();

  const abiertos = incidents.filter((i) => i.status === "ABIERTO" || i.status === "EN_INVESTIGACION").length;
  const cerrados = incidents.filter((i) => i.status === "CERRADO").length;

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Incidentes de IA</h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Registro de incidentes, sesgos y fallos en sistemas IA del inventario
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/ai-governance/incidentes/nuevo")}
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo incidente
        </button>
      </div>

      {/* Stats rápidas */}
      {!isLoading && incidents.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Total incidentes", value: incidents.length, tone: "info" },
            { label: "Abiertos / En investigación", value: abiertos, tone: abiertos > 0 ? "error" : "success" },
            { label: "Cerrados", value: cerrados, tone: "success" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] px-5 py-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className={`text-2xl font-bold ${
                stat.tone === "error"
                  ? "text-[var(--status-error)]"
                  : stat.tone === "success"
                  ? "text-[var(--status-success)]"
                  : "text-[var(--g-brand-3308)]"
              }`}>
                {stat.value}
              </div>
              <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-16" style={{ borderRadius: "var(--g-radius-md)" }} />)}
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">Sin incidentes registrados</p>
            <p className="text-xs text-[var(--g-text-secondary)] mt-1">El sistema IA está operando sin incidencias</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Incidente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Sistema</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Severidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Reportado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Escalación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {incidents.map((inc) => {
                const sevCls = SEVERITY_CHIP[inc.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const stCls = STATUS_CHIP[inc.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const isMaterial = isAimsMaterialIncidentCandidate(inc);
                return (
                  <tr
                    key={inc.id}
                    className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                    onClick={() => inc.system_id && navigate(`/ai-governance/sistemas/${inc.system_id}`)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">{inc.title}</p>
                      {inc.description && (
                        <p className="text-xs text-[var(--g-text-secondary)] mt-0.5 line-clamp-1">{inc.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {inc.ai_systems?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-bold ${sevCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {inc.severity ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${stCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {new Date(inc.reported_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      {isMaterial ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${inc.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-muted)]"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                            GRC
                          </Link>
                          <Link
                            to={`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${inc.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                            Secretaría
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--g-text-secondary)]">Seguimiento AIMS</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
