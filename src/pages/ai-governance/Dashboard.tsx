import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Brain, Clock, Cpu } from "lucide-react";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useAiIncidentsList } from "@/hooks/useAiIncidents";
import { useAllAssessments, useAllComplianceChecks } from "@/hooks/useAiAssessments";
import {
  assessmentAcreditaConformidad,
  buildAimsReadiness,
  filterSystemsByScope,
  isAimsMaterialIncidentCandidate,
  normalizeAimsStatus,
  systemStatusChipClass,
  systemStatusLabel,
} from "@/lib/aims/readiness";
import { useScope } from "@/context/ScopeContext";
import { useTenantContext } from "@/context/TenantContext";
import { useBodyBySlug } from "@/hooks/useBodies";
import { aiGovernanceBodySlug } from "@/lib/aims/governing-body";
import { claseNivelRiesgo } from "@/lib/aims/vocabulario";
import { ClasificacionGuiadaCard } from "@/components/ai-governance/dashboard/ClasificacionGuiadaCard";
import { ComplianceMonitorPanel } from "@/components/ai-governance/dashboard/ComplianceMonitorPanel";
import { IncidentesRecientes } from "@/components/ai-governance/dashboard/IncidentesRecientes";
import { OrganoRector } from "@/components/ai-governance/dashboard/OrganoRector";
import { PrioridadAhora } from "@/components/ai-governance/dashboard/PrioridadAhora";
import { ReadinessDomains } from "@/components/ai-governance/dashboard/ReadinessDomains";

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const cls = claseNivelRiesgo(level);
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
  tone?: "success" | "error" | "warning" | "info" | "neutral";
  to?: string;
}) {
  const navigate = useNavigate();
  // `neutral` para el cero SIN dato: un 0 verde afirma «no hay ninguno» cuando
  // en realidad no hay nada con que contarlo.
  const toneColor: Record<string, string> = {
    success: "text-[var(--status-success)]",
    error:   "text-[var(--status-error)]",
    warning: "text-[var(--status-warning)]",
    info:    "text-[var(--status-info)]",
    neutral: "text-[var(--g-text-secondary)]",
  };
  const iconBg: Record<string, string> = {
    success: "bg-[var(--status-success)]/10",
    error:   "bg-[var(--status-error)]/10",
    warning: "bg-[var(--status-warning)]/10",
    info:    "bg-[var(--status-info)]/10",
    neutral: "bg-[var(--g-surface-muted)]",
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
  const { scope } = useScope();
  // Órgano de gobierno de la IA del tenant. Doble puerta: el mapa no devuelve
  // slug para un tenant sin órgano declarado, y `useBodyBySlug` filtra por
  // `tenant_id`, así que tampoco lo encontraría. Si no hay fila, no se pinta
  // nada — que es lo que corresponde cuando nadie ha constituido el órgano.
  const { tenantId } = useTenantContext();
  const { data: aiBody } = useBodyBySlug(aiGovernanceBodySlug(tenantId) ?? undefined);
  const { data: rawSystems = [], isLoading: loadingSystems } = useAiSystemsList();
  const { data: rawIncidents = [], isLoading: loadingIncidents } = useAiIncidentsList();
  const { data: rawAssessments = [], isLoading: loadingAssessments } = useAllAssessments();
  const { data: rawComplianceChecks = [], isLoading: loadingComplianceChecks } = useAllComplianceChecks();

  const systems = filterSystemsByScope(rawSystems, scope);
  const systemIds = new Set(systems.map((s) => s.id));

  const incidents = rawIncidents.filter((i) => i.system_id && systemIds.has(i.system_id));
  const assessments = rawAssessments.filter((a) => a.system_id && systemIds.has(a.system_id));
  const complianceChecks = rawComplianceChecks.filter((c) => c.system_id && systemIds.has(c.system_id));

  // Comparación sobre el vocabulario normalizado, como el resto del módulo:
  // `ai_systems.status` convive con cinco grafías en Cloud (ACTIVO,
  // EN_EVALUACION, Pendiente, Conforme, En revision). Con la igualdad estricta
  // un «Activo» en otra grafía no contaba. Hoy ARGA no cambia: sus 4 activos
  // ya están escritos como ACTIVO.
  const activos = systems.filter((s) => normalizeAimsStatus(s.status) === "ACTIVO").length;
  // Un sistema «en evaluación» no es un sistema parado: en el piloto real es
  // una herramienta en producción limitada, con usuarios y con exposición. El
  // contador de ACTIVOS no se toca —dice la verdad de lo que cuenta— pero un
  // tenant con 0 activos y 1 en evaluación leía «—» y parecía vacío.
  const enEvaluacion = systems.filter((s) => normalizeAimsStatus(s.status) === "EN_EVALUACION").length;
  const detalleInventario = [
    `${systems.length} en inventario`,
    enEvaluacion > 0 ? `${enEvaluacion} en evaluación` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const alto    = systems.filter((s) => s.risk_level === "Alto").length;
  const limitado = systems.filter((s) => s.risk_level === "Limitado").length;
  const minimo  = systems.filter((s) => s.risk_level === "Mínimo").length;

  const sistemasClasificados = systems.filter((s) => (s.risk_level ?? "").trim() !== "").length;

  const incidentesAbiertos = incidents.filter(
    (i) => ["ABIERTO", "EN_INVESTIGACION"].includes(normalizeAimsStatus(i.status))
  ).length;

  // `APROBADO` es legado: el producto escribe `CONFORME`. Predicado único en
  // `readiness.ts` para que escritura y lectura no vuelvan a divergir.
  const approvedSysIds = new Set(
    assessments.filter((a) => assessmentAcreditaConformidad(a.status)).map((a) => a.system_id)
  );
  const altosNoEvaluados = systems.filter(
    (s) => s.risk_level === "Alto" && !approvedSysIds.has(s.id)
  ).length;

  // Días desde última evaluación
  const lastAssessment = assessments.find((a) => a.assessment_date);
  const diasDesdeEval = lastAssessment?.assessment_date
    ? Math.floor((Date.now() - new Date(lastAssessment.assessment_date).getTime()) / 86400000)
    : null;

  const readiness = buildAimsReadiness({ systems, assessments, incidents, complianceChecks });
  const loading = loadingSystems || loadingIncidents || loadingAssessments || loadingComplianceChecks;
  // Un solo predicado para «incidente material», el mismo que decide el handoff.
  // Aquí se comparaba a mano contra tres grafías, y una de ellas ('CRÍTICO')
  // no la escribe ningún camino del producto.
  const materialIncidents = incidents.filter(isAimsMaterialIncidentCandidate).length;

  return (
    <div className="mx-auto max-w-[1320px] p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-5 w-5 text-[var(--g-brand-3308)]" />
          <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Mesa de trabajo AI Governance</h1>
          <span
            className="text-xs font-medium text-[var(--g-text-inverse)] bg-[var(--g-brand-3308)] px-2 py-0.5"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            EU AI Act
          </span>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
          Sistemas IA, evaluaciones e incidentes materiales. AIMS conserva el alta y actualización; GRC y Secretaría reciben handoffs de solo lectura.
        </p>
      </div>

      {aiBody && <OrganoRector slug={aiBody.slug} name={aiBody.name} />}

      <PrioridadAhora
        altosNoEvaluados={altosNoEvaluados}
        materialIncidents={materialIncidents}
        activos={activos}
        totalSistemas={systems.length}
        totalIncidentes={incidents.length}
        detalleInventario={detalleInventario}
        sistemasClasificados={sistemasClasificados}
        loading={loading}
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-32 skeleton" style={{ borderRadius: "var(--g-radius-lg)" }} />
          ))}
        </div>
      ) : (
        <>
          <ComplianceMonitorPanel monitors={readiness.complianceMonitors} />

          {/* KPIs principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Sistemas IA activos"
              value={systems.length === 0 ? "—" : activos}
              sub={systems.length === 0 ? "Sin inventario registrado" : detalleInventario}
              icon={Cpu}
              tone={systems.length === 0 ? "neutral" : "info"}
              to="/ai-governance/sistemas"
            />
            <KpiCard
              label="Riesgo Alto sin eval. aprobada"
              value={systems.length === 0 ? "—" : altosNoEvaluados}
              sub={systems.length === 0 ? "Sin inventario registrado" : "Requieren evaluación EU AI Act"}
              icon={AlertTriangle}
              tone={systems.length === 0 ? "neutral" : altosNoEvaluados > 0 ? "error" : "success"}
              to="/ai-governance/evaluaciones"
            />
            <KpiCard
              label="Incidentes abiertos"
              value={incidents.length === 0 ? "—" : incidentesAbiertos}
              sub={incidents.length === 0 ? "Sin incidentes registrados" : "Abiertos o en investigación"}
              icon={AlertTriangle}
              tone={incidents.length === 0 ? "neutral" : incidentesAbiertos > 0 ? "warning" : "success"}
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

          <ClasificacionGuiadaCard systems={systems} />

          <ReadinessDomains
            readiness={readiness}
            veredicto={readiness.standaloneReady ? "Standalone-ready" : "Standalone con gaps"}
            totalSistemas={systems.length}
            totalEvaluaciones={assessments.length}
            totalIncidentes={incidents.length}
          />

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
                  // Cuarta fila obligatoria: las tres anteriores sólo cuentan
                  // los tres literales de clasificación, así que un sistema sin
                  // `risk_level` desaparecía de una «distribución» que dejaba
                  // de sumar el inventario. Un sistema sin clasificar no es un
                  // sistema de riesgo mínimo. ARGA tiene hoy sus 8 clasificados
                  // y ve un 0; el catálogo de Garrigues siembra `risk_level`
                  // nulo a propósito y ahí es donde el hueco se lee.
                  {
                    label: "Sin clasificar",
                    count: systems.length - sistemasClasificados,
                    total: systems.length,
                    color: "bg-[var(--g-surface-muted)]",
                  },
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

            <IncidentesRecientes incidents={incidents} />
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
            <div className="divide-y divide-[var(--g-border-subtle)] md:hidden">
              {systems.slice(0, 5).map((sys) => (
                <Link
                  key={sys.id}
                  to={`/ai-governance/sistemas/${sys.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--g-text-primary)]">{sys.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{sys.vendor ?? "Proveedor no informado"}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <RiskBadge level={sys.risk_level} />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${systemStatusChipClass(sys.status)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {systemStatusLabel(sys.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <table className="hidden w-full md:table">
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
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${systemStatusChipClass(sys.status)}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {systemStatusLabel(sys.status)}
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
