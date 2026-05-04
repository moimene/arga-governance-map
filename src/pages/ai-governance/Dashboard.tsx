import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  Database,
  FileCheck2,
  GitBranch,
  ListChecks,
  Route,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useAiIncidentsList } from "@/hooks/useAiIncidents";
import { useAllAssessments } from "@/hooks/useAiAssessments";
import {
  aimsReadOnlyHandoffs,
  aimsScreenPostures,
  buildAimsReadiness,
  type AimsReadinessDomain,
  type AimsReadinessStatus,
} from "@/lib/aims/readiness";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const AI_STATUS_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  EN_EVALUACION: "En evaluación",
  RETIRADO: "Retirado",
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

const READINESS_STATUS: Record<AimsReadinessStatus, { label: string; className: string }> = {
  ready: {
    label: "Listo",
    className: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  },
  watch: {
    label: "Vigilancia",
    className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  },
  gap: {
    label: "Gap",
    className: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  },
};

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  inventory: Database,
  "ai-act-assessments": ClipboardCheck,
  incidents: AlertTriangle,
  controls: ShieldCheck,
  "operational-evidence": FileCheck2,
  migration: GitBranch,
};

function ReadinessBadge({ status }: { status: AimsReadinessStatus }) {
  const meta = READINESS_STATUS[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      {meta.label}
    </span>
  );
}

function ReadinessDomainCard({ domain }: { domain: AimsReadinessDomain }) {
  const Icon = DOMAIN_ICONS[domain.id] ?? ListChecks;
  return (
    <Link
      to={domain.route}
      className="block border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 hover:border-[var(--g-brand-3308)] transition-colors"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{domain.label}</h3>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)] leading-relaxed">{domain.detail}</p>
          </div>
        </div>
        <ReadinessBadge status={domain.status} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--g-text-primary)]">{domain.metric}</span>
        <ArrowRight className="h-3.5 w-3.5 text-[var(--g-text-secondary)]" />
      </div>
    </Link>
  );
}

function ScreenPostureTable() {
  return (
    <details
      className="mt-5 overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <summary className="flex cursor-pointer items-center gap-2 border-b border-[var(--g-border-subtle)] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
        <ListChecks className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <h3 className="text-xs font-semibold uppercase text-[var(--g-text-primary)]">
          Contexto técnico AIMS
        </h3>
        <span
          className="ml-auto bg-[var(--g-surface-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          solo lectura demo
        </span>
      </summary>
      <div className="grid gap-3 p-4 md:hidden">
        {aimsScreenPostures.map((screen) => (
          <div
            key={screen.route}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--g-text-primary)]">{screen.screen}</p>
                <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">{screen.route}</p>
              </div>
              <span
                className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-text-secondary)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {screen.operation}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--g-text-secondary)]">
              {screen.crossModuleHandoffs.join("; ")}
            </p>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Pantalla
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Datos responsables
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Operación
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Handoff seguro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {aimsScreenPostures.map((screen) => (
              <tr key={screen.route} className="hover:bg-[var(--g-surface-subtle)]/50">
                <td className="px-4 py-3 align-top">
                  <p className="text-sm font-semibold text-[var(--g-text-primary)]">{screen.screen}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--g-text-secondary)]">{screen.route}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="text-xs text-[var(--g-text-primary)]">{screen.tables.join(", ")}</p>
                  <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">{screen.sourceOfTruth}</p>
                </td>
                <td className="px-4 py-3 align-top">
                  <span
                    className="inline-flex bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {screen.operation}
                  </span>
                  <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                    Sin migración ni escrituras cross-module.
                  </p>
                </td>
                <td className="px-4 py-3 align-top">
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    {screen.crossModuleHandoffs.join("; ")}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function HandoffAffordances() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {aimsReadOnlyHandoffs.map((handoff) => (
        <Link
          key={handoff.id}
          to={handoff.targetRoute}
          className="block border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 transition-colors hover:border-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{handoff.label}</h3>
                <span
                  className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {handoff.evidencePosture}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--g-text-secondary)]">
                {handoff.trigger}. {handoff.targetOwner} conserva la decisión; AIMS solo enruta.
              </p>
              <p className="mt-2 font-mono text-[11px] text-[var(--g-text-secondary)]">{handoff.contractEvent}</p>
            </div>
          </div>
        </Link>
      ))}
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

  const readiness = buildAimsReadiness({ systems, assessments, incidents });
  const loading = loadingSystems || loadingIncidents || loadingAssessments;
  const materialIncidents = incidents.filter(
    (incident) =>
      ["CRITICO", "CRÍTICO", "ALTO"].includes(incident.severity ?? "") &&
      ["ABIERTO", "EN_INVESTIGACION"].includes(incident.status ?? "")
  ).length;
  const priorityItems = [
    {
      label: "Alto riesgo sin evaluación aprobada",
      value: altosNoEvaluados,
      body: "Cerrar evaluación AI Act antes de presentar el sistema como controlado.",
      to: "/ai-governance/evaluaciones",
      icon: ClipboardCheck,
      tone: altosNoEvaluados > 0 ? "text-[var(--status-error)]" : "text-[var(--status-success)]",
    },
    {
      label: "Incidentes materiales de IA",
      value: materialIncidents,
      body: "Revisar severidad, causa raíz y posible handoff a GRC o Secretaría.",
      to: "/ai-governance/incidentes",
      icon: AlertTriangle,
      tone: materialIncidents > 0 ? "text-[var(--status-warning)]" : "text-[var(--status-success)]",
    },
    {
      label: "Inventario activo",
      value: activos,
      body: `${systems.length} sistemas registrados en AIMS con clasificación de riesgo.`,
      to: "/ai-governance/sistemas",
      icon: Cpu,
      tone: "text-[var(--status-info)]",
    },
  ];
  const quickActions = [
    { label: "Nuevo sistema IA", body: "Alta gestionada en AIMS.", to: "/ai-governance/sistemas/nuevo", icon: PlusCircle },
    { label: "Revisar evaluaciones", body: "Cobertura AI Act, findings y expediente técnico.", to: "/ai-governance/evaluaciones", icon: ClipboardCheck },
    { label: "Registrar incidente IA", body: "Incidente gestionado con severidad y sistema asociado.", to: "/ai-governance/incidentes/nuevo", icon: AlertTriangle },
    { label: "Proponer riesgo GRC", body: "Handoff de solo lectura para que GRC decida el riesgo.", to: "/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP", icon: Route },
  ];

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

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <div
          className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
              Prioridad ahora
            </p>
            <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
              Sistemas, evaluaciones e incidentes que requieren criterio
            </h2>
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {priorityItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex min-h-[92px] items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</span>
                      <span className={`text-sm font-bold tabular-nums ${item.tone}`}>{loading ? "..." : item.value}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--g-text-secondary)]">{item.body}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                </Link>
              );
            })}
          </div>
        </div>

        <div
          className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
              Empezar un flujo
            </p>
            <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
              Acciones del officer AIMS
            </h2>
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--g-text-secondary)]">{item.body}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

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

          {/* AIMS readiness P0 */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 mb-6"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-[var(--g-brand-3308)]" />
                  <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                    Readiness de demo AIMS
                  </h2>
                  <span
                    className="text-[10px] font-bold uppercase text-[var(--g-text-inverse)] bg-[var(--g-brand-3308)] px-2 py-0.5"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Standalone-ready
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-xs text-[var(--g-text-secondary)] leading-relaxed">
                  Inventario, evaluaciones e incidentes ya son navegables. La migración técnica queda
                  como contexto, no como tarea principal del officer.
                </p>
              </div>
              <div
                className="min-w-[220px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      readiness.standaloneReady ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"
                    }`}
                  />
                  <span className="text-xs font-semibold text-[var(--g-text-primary)]">
                    {readiness.standaloneReady ? "Demo operable" : "Demo con gaps"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                  Estado de fuentes: datos demo conectados
                </p>
                <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                  Contrato: demostrador AIMS P0
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {readiness.domains.map((domain) => (
                <ReadinessDomainCard key={domain.id} domain={domain} />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                style={{ borderRadius: "var(--g-radius-lg)" }}
              >
                <h3 className="text-xs font-semibold uppercase text-[var(--g-text-primary)]">
                  Contrato de datos
                </h3>
                <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <dt className="text-[11px] text-[var(--g-text-secondary)]">Fuentes</dt>
                    <dd className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">
                      Inventario, evaluaciones e incidentes
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--g-text-secondary)]">Mutación</dt>
                    <dd className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">Solo lectura en dashboard</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--g-text-secondary)]">Migración</dt>
                    <dd className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">Pendiente, sin schema nuevo</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                  La compatibilidad técnica futura se mantiene como contrato, sin nuevas escrituras en esta rebanada.
                </p>
              </div>

              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                style={{ borderRadius: "var(--g-radius-lg)" }}
              >
                <h3 className="text-xs font-semibold uppercase text-[var(--g-text-primary)]">
                  Próximos pasos
                </h3>
                <ul className="mt-3 space-y-2">
                  {readiness.nextSteps.map((step) => (
                    <li key={step} className="flex items-start gap-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 bg-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ScreenPostureTable />

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-xs font-semibold uppercase text-[var(--g-text-primary)]">
                  Handoffs de solo lectura
                </h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--g-text-secondary)]">
                Rutas de entrada a módulos responsables. AIMS enruta contexto, no toma decisiones de GRC ni de Secretaría.
              </p>
              <HandoffAffordances />
            </div>
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
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                        sys.status === "ACTIVO"
                          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                          : sys.status === "EN_EVALUACION"
                          ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {AI_STATUS_LABEL[sys.status] ?? sys.status}
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
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                          sys.status === "ACTIVO"
                            ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                            : sys.status === "EN_EVALUACION"
                            ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {AI_STATUS_LABEL[sys.status] ?? sys.status}
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
