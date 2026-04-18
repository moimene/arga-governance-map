import { useNavigate } from "react-router-dom";
import { Brain, Cpu, AlertTriangle, ClipboardCheck, Clock, ArrowRight } from "lucide-react";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useAiIncidentsList } from "@/hooks/useAiIncidents";
import { useAllAssessments } from "@/hooks/useAiAssessments";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const cls = RISK_COLORS[level] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${cls}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {level}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone?: "success" | "error" | "warning" | "info";
  to?: string;
}) {
  const navigate = useNavigate();
  const toneColor: Record<string, string> = {
    success: "text-[var(--status-success)]",
    error:   "text-[var(--status-error)]",
    warning: "text-[var(--status-warning)]",
    info:    "text-[var(--status-info)]",
  };
  const iconBg: Record<string, string> = {
    success: "bg-[var(--status-success)]/10",
    error:   "bg-[var(--status-error)]/10",
    warning: "bg-[var(--status-warning)]/10",
    info:    "bg-[var(--status-info)]/10",
  };
  const t = tone ?? "info";
  return (
    <div
      className={`bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 flex flex-col gap-3 ${to ? "cursor-pointer hover:border-[var(--g-brand-3308)] transition-colors" : ""}`}
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      onClick={to ? () => navigate(to) : undefined}
      role={to ? "button" : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => e.key === "Enter" && navigate(to) : undefined}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center ${iconBg[t]}`} style={{ borderRadius: "var(--g-radius-md)" }}>
          <Icon className={`h-5 w-5 ${toneColor[t]}`} />
        </div>
        {to && <ArrowRight className="h-4 w-4 text-[var(--g-text-secondary)]" />}
      </div>
      <div>
        <div className={`text-2xl font-bold ${toneColor[t]}`}>{value}</div>
        <div className="text-sm font-medium text-[var(--g-text-primary)] mt-0.5">{label}</div>
        {sub && <div className="text-xs text-[var(--g-text-secondary)] mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function AiDashboard() {
  const { data: systems = [], isLoading: loadingSystems } = useAiSystemsList();
  const { data: incidents = [], isLoading: loadingIncidents } = useAiIncidentsList();
  const { data: assessments = [], isLoading: loadingAssessments } = useAllAssessments();

  const activos = systems.filter((s) => s.status === "ACTIVO").length;
  const alto    = systems.filter((s) => s.risk_level === "Alto").length;
  const limitado = systems.filter((s) => s.risk_level === "Limitado").length;
  const minimo  = systems.filter((s) => s.risk_level === "Mínimo").length;

  const incidentesAbiertos = incidents.filter(
    (i) => i.status === "ABIERTO" || i.status === "EN_INVESTIGACION"
  ).length;

  const approvedSysIds = new Set(
    assessments.filter((a) => a.status === "APROBADO").map((a) => a.system_id)
  );
  const altosNoEvaluados = systems.filter(
    (s) => s.risk_level === "Alto" && !approvedSysIds.has(s.id)
  ).length;

  // Días desde última evaluación
  const lastAssessment = assessments.find((a) => a.assessment_date);
  const diasDesdeEval = lastAssessment?.assessment_date
    ? Math.floor((Date.now() - new Date(lastAssessment.assessment_date).getTime()) / 86400000)
    : null;

  const loading = loadingSystems || loadingIncidents || loadingAssessments;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-5 w-5 text-[var(--g-brand-3308)]" />
          <h1 className="text-xl font-bold text-[var(--g-text-primary)]">AI Governance</h1>
          <span
            className="text-xs font-medium text-[var(--g-text-inverse)] bg-[var(--g-brand-3308)] px-2 py-0.5"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            EU AI Act
          </span>
        </div>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Inventario, evaluación de riesgos e incidentes de sistemas de IA — Grupo ARGA Seguros
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-32 skeleton" style={{ borderRadius: "var(--g-radius-lg)" }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Sistemas IA activos"
              value={activos}
              sub={`${systems.length} total en inventario`}
              icon={Cpu}
              tone="info"
              to="/ai-governance/sistemas"
            />
            <KpiCard
              label="Riesgo Alto sin eval. aprobada"
              value={altosNoEvaluados}
              sub="Requieren evaluación EU AI Act"
              icon={AlertTriangle}
              tone={altosNoEvaluados > 0 ? "error" : "success"}
              to="/ai-governance/evaluaciones"
            />
            <KpiCard
              label="Incidentes abiertos"
              value={incidentesAbiertos}
              sub="Abiertos o en investigación"
              icon={AlertTriangle}
              tone={incidentesAbiertos > 0 ? "warning" : "success"}
              to="/ai-governance/incidentes"
            />
            <KpiCard
              label="Última evaluación"
              value={diasDesdeEval !== null ? `${diasDesdeEval}d` : "—"}
              sub={lastAssessment?.assessment_date ?? "Sin evaluaciones"}
              icon={Clock}
              tone="info"
              to="/ai-governance/evaluaciones"
            />
          </div>

          {/* Distribución por nivel de riesgo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 lg:col-span-2"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-4">
                Distribución por nivel de riesgo (EU AI Act)
              </h2>
              <div className="space-y-3">
                {[
                  { label: "Alto", count: alto, total: systems.length, color: "bg-[var(--status-error)]" },
                  { label: "Limitado", count: limitado, total: systems.length, color: "bg-[var(--status-warning)]" },
                  { label: "Mínimo", count: minimo, total: systems.length, color: "bg-[var(--status-success)]" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-medium text-[var(--g-text-secondary)]">{row.label}</div>
                    <div className="flex-1 h-2 bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                      <div
                        className={`h-2 ${row.color} transition-all`}
                        style={{
                          borderRadius: "var(--g-radius-full)",
                          width: row.total > 0 ? `${(row.count / row.total) * 100}%` : "0%",
                        }}
                      />
                    </div>
                    <div className="w-6 text-xs font-bold text-[var(--g-text-primary)] text-right">{row.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen rápido incidentes */}
            <div
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-4">Incidentes recientes</h2>
              {incidents.length === 0 ? (
                <p className="text-xs text-[var(--g-text-secondary)]">Sin incidentes registrados</p>
              ) : (
                <div className="space-y-3">
                  {incidents.slice(0, 3).map((inc) => (
                    <div key={inc.id} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex shrink-0 items-center px-1.5 py-0.5 text-[10px] font-bold text-[var(--g-text-inverse)] ${
                          inc.severity === "ALTO" || inc.severity === "CRITICO"
                            ? "bg-[var(--status-error)]"
                            : inc.severity === "MEDIO"
                            ? "bg-[var(--status-warning)]"
                            : "bg-[var(--status-info)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {inc.severity}
                      </span>
                      <p className="text-xs text-[var(--g-text-secondary)] leading-snug line-clamp-2">{inc.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabla rápida de sistemas */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--g-border-subtle)]">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Inventario de Sistemas IA</h2>
              <a
                href="/ai-governance/sistemas"
                className="text-xs font-medium text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)] flex items-center gap-1"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </a>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--g-surface-subtle)]">
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Sistema</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Riesgo EU AI Act</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g-border-subtle)]">
                {systems.slice(0, 5).map((sys) => (
                  <tr
                    key={sys.id}
                    className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/ai-governance/sistemas/${sys.id}`}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">{sys.name}</p>
                      <p className="text-xs text-[var(--g-text-secondary)]">{sys.vendor}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{sys.system_type ?? "—"}</td>
                    <td className="px-6 py-4">
                      <RiskBadge level={sys.risk_level} />
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                          sys.status === "ACTIVO"
                            ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                            : sys.status === "EN_EVALUACION"
                            ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {sys.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
