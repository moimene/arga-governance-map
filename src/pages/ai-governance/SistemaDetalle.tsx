import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Cpu, Calendar, Building2, AlertTriangle, ClipboardCheck } from "lucide-react";
import { useAiSystemById } from "@/hooks/useAiSystems";
import { useAssessmentsBySystem, useComplianceChecksBySystem } from "@/hooks/useAiAssessments";
import { useAiIncidentsBySystem } from "@/hooks/useAiIncidents";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const CHECK_STATUS_CHIP: Record<string, string> = {
  CONFORME:     "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_CURSO:     "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  PENDIENTE:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  NO_CONFORME:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  NA:           "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const ASSESSMENT_STATUS_CHIP: Record<string, string> = {
  APROBADO:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_REVISION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const INCIDENT_SEVERITY_CHIP: Record<string, string> = {
  CRITICO:     "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  ALTO:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  MEDIO:       "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BAJO:        "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
};

export default function SistemaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: system, isLoading: loadSys } = useAiSystemById(id);
  const { data: assessments = [] } = useAssessmentsBySystem(id);
  const { data: checks = [] } = useComplianceChecksBySystem(id);
  const { data: incidents = [] } = useAiIncidentsBySystem(id);

  if (loadSys) {
    return (
      <div className="p-6 max-w-[900px] mx-auto space-y-4">
        {[1,2,3].map((i) => <div key={i} className="skeleton h-24" style={{ borderRadius: "var(--g-radius-lg)" }} />)}
      </div>
    );
  }

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Cpu className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
        <p className="text-sm font-medium text-[var(--g-text-primary)]">Sistema no encontrado</p>
        <button
          type="button"
          onClick={() => navigate("/ai-governance/sistemas")}
          className="mt-4 text-sm text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
        >
          Volver al inventario
        </button>
      </div>
    );
  }

  const riskCls = RISK_COLORS[system.risk_level ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate("/ai-governance/sistemas")}
        className="flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Inventario de Sistemas IA
      </button>

      {/* Header card */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6 mb-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Cpu className="h-5 w-5 text-[var(--g-brand-3308)]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--g-text-primary)]">{system.name}</h1>
              <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">{system.description}</p>
            </div>
          </div>
          {system.risk_level && (
            <span
              className={`shrink-0 inline-flex items-center px-2.5 py-1 text-sm font-semibold ${riskCls}`}
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              Riesgo {system.risk_level}
            </span>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--g-border-subtle)]">
          <div>
            <p className="text-xs text-[var(--g-text-secondary)] mb-0.5">Tipo de sistema</p>
            <p className="text-sm font-medium text-[var(--g-text-primary)]">{system.system_type ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <Building2 className="h-3 w-3 text-[var(--g-text-secondary)]" />
              <p className="text-xs text-[var(--g-text-secondary)]">Vendor</p>
            </div>
            <p className="text-sm font-medium text-[var(--g-text-primary)]">{system.vendor ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <Calendar className="h-3 w-3 text-[var(--g-text-secondary)]" />
              <p className="text-xs text-[var(--g-text-secondary)]">Despliegue</p>
            </div>
            <p className="text-sm font-medium text-[var(--g-text-primary)]">
              {system.deployment_date
                ? new Date(system.deployment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--g-text-secondary)] mb-0.5">Estado</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                system.status === "ACTIVO"
                  ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  : system.status === "EN_EVALUACION"
                  ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {system.status}
            </span>
          </div>
        </div>

        {system.use_case && (
          <div className="mt-4 pt-4 border-t border-[var(--g-border-subtle)]">
            <p className="text-xs text-[var(--g-text-secondary)] mb-0.5">Caso de uso</p>
            <p className="text-sm text-[var(--g-text-primary)]">{system.use_case}</p>
          </div>
        )}
      </div>

      {/* Evaluaciones */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] mb-4 overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--g-border-subtle)]">
          <ClipboardCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Evaluaciones de Riesgo</h2>
          <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{assessments.length}</span>
        </div>
        {assessments.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-[var(--g-text-secondary)]">Sin evaluaciones registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {assessments.map((ass) => {
              const statusCls = ASSESSMENT_STATUS_CHIP[ass.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
              return (
                <div key={ass.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--g-text-primary)]">{ass.framework}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {ass.status}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--g-text-secondary)]">
                      {ass.assessment_date
                        ? new Date(ass.assessment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </span>
                  </div>
                  {ass.score !== null && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--g-text-secondary)]">Score de cumplimiento</span>
                        <span className="text-sm font-bold text-[var(--g-text-primary)]">{ass.score}/100</span>
                      </div>
                      <div className="h-2 bg-[var(--g-surface-muted)] overflow-hidden" style={{ borderRadius: "var(--g-radius-full)" }}>
                        <div
                          className={`h-2 transition-all ${
                            ass.score >= 80
                              ? "bg-[var(--status-success)]"
                              : ass.score >= 60
                              ? "bg-[var(--status-warning)]"
                              : "bg-[var(--status-error)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-full)", width: `${ass.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {Array.isArray(ass.findings) && ass.findings.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ass.findings.map((f: { code: string; status: string }, idx: number) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs ${
                            f.status === "CONFORME"
                              ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                              : f.status === "NO_CONFORME"
                              ? "bg-[var(--status-error)]/10 text-[var(--status-error)]"
                              : "bg-[var(--status-warning)]/10 text-[var(--g-text-secondary)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {f.code}: {f.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Controles de cumplimiento */}
      {checks.length > 0 && (
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] mb-4 overflow-hidden"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--g-border-subtle)]">
            <ClipboardCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Controles de Cumplimiento</h2>
            <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{checks.length}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Requisito</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {checks.map((chk) => {
                const chipCls = CHECK_STATUS_CHIP[chk.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                return (
                  <tr key={chk.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                    <td className="px-6 py-3 text-xs font-mono text-[var(--g-text-secondary)]">{chk.requirement_code}</td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-primary)]">{chk.requirement_title ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${chipCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {chk.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Incidentes vinculados */}
      {incidents.length > 0 && (
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--g-border-subtle)]">
            <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Incidentes vinculados</h2>
            <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{incidents.length}</span>
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {incidents.map((inc) => {
              const sevCls = INCIDENT_SEVERITY_CHIP[inc.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
              return (
                <div key={inc.id} className="px-6 py-4 flex items-start gap-3">
                  <span
                    className={`shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 text-xs font-bold ${sevCls}`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {inc.severity}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">{inc.title}</p>
                    {inc.description && (
                      <p className="text-xs text-[var(--g-text-secondary)] mt-0.5 line-clamp-2">{inc.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium ${
                          inc.status === "ABIERTO"
                            ? "bg-[var(--status-error)]/10 text-[var(--status-error)]"
                            : inc.status === "EN_INVESTIGACION"
                            ? "bg-[var(--status-warning)]/10 text-[var(--g-text-secondary)]"
                            : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {inc.status}
                      </span>
                      <span className="text-[10px] text-[var(--g-text-secondary)]">
                        {new Date(inc.reported_at).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
