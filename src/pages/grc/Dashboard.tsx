import { useGrcKpis } from "@/hooks/useGrcDashboard";
import {
  GRC_HANDOFF_CANDIDATES,
  GRC_NOT_CONNECTED_BACKLOG,
  GRC_P0_DOMAINS,
  GRC_SCREEN_POSTURES,
  type GrcP0Domain,
  getGrcHandoffCandidate,
  getGrcP0ReadinessSummary,
  getGrcScreenPostureSummary,
} from "@/lib/grc/dashboard-readiness";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  Briefcase,
  FileWarning,
  Send,
  ArrowRight,
  Shield,
  CheckCircle2,
  CircleDashed,
  Database,
  ListChecks,
  Route,
  TriangleAlert,
  Waypoints,
} from "lucide-react";

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: number | undefined;
  tone?: "danger" | "warning" | "neutral";
}) {
  const iconColor =
    tone === "danger"
      ? "text-[var(--status-error)]"
      : tone === "warning"
      ? "text-[var(--status-warning)]"
      : "text-[var(--g-text-secondary)]";

  return (
    <div
      className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 flex flex-col gap-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--g-text-secondary)] uppercase tracking-wider">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="text-3xl font-bold text-[var(--g-text-primary)]">
        {value ?? <span className="text-[var(--g-text-secondary)]">—</span>}
      </div>
    </div>
  );
}

const READINESS_LABEL: Record<GrcP0Domain["readiness"], string> = {
  ready: "Listo para demo",
  watch: "Requiere foco",
  gap: "Gap controlado",
};

const READINESS_CHIP: Record<GrcP0Domain["readiness"], string> = {
  ready: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  watch: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  gap: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
};

const READINESS_ICON: Record<GrcP0Domain["readiness"], React.ElementType> = {
  ready: CheckCircle2,
  watch: TriangleAlert,
  gap: CircleDashed,
};

const SOURCE_POSTURE_LABEL = {
  legacy_read: "Legacy read",
  legacy_write: "Legacy write",
  tgms_handoff: "TGMS handoff",
  local_demo_read: "Demo local",
  backlog_placeholder: "Backlog",
};

const ACCESS_CHIP = {
  "read-only": "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  "owner-write": "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  backlog: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
};

function ReadinessDomainCard({ domain }: { domain: GrcP0Domain }) {
  const StatusIcon = READINESS_ICON[domain.readiness];

  return (
    <Link
      to={domain.route}
      className="flex min-h-[188px] flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 transition-colors hover:bg-[var(--g-surface-subtle)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
            {domain.label}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
            {domain.executiveSignal}
          </p>
        </div>
        <StatusIcon className="h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-1 text-[11px] font-medium ${READINESS_CHIP[domain.readiness]}`}
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {READINESS_LABEL[domain.readiness]}
        </span>
        <span
          className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-1 text-[11px] font-medium text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          <Database className="h-3 w-3" />
          {domain.sourceLabel}
        </span>
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--g-text-secondary)]">Cobertura demo</span>
          <span className="font-semibold text-[var(--g-text-primary)]">{domain.coverage}%</span>
        </div>
        <div
          className="h-2 overflow-hidden bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
          aria-hidden="true"
        >
          <div
            className="h-full bg-[var(--g-brand-3308)]"
            style={{ width: `${domain.coverage}%` }}
          />
        </div>
        <p className="pt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
          {domain.nextStep}
        </p>
      </div>
    </Link>
  );
}

export default function GrcDashboard() {
  const { data: kpis, isLoading } = useGrcKpis();
  const readiness = getGrcP0ReadinessSummary();
  const screenSummary = getGrcScreenPostureSummary();
  const highlightedScreens = GRC_SCREEN_POSTURES.filter((screen) => screen.accessMode !== "backlog").slice(0, 8);
  const priorityItems = [
    {
      label: "Riesgos críticos",
      value: kpis?.criticalRisks ?? 0,
      body: "Priorizar mitigación o escalado al órgano correspondiente.",
      to: "/grc/risk-360",
      tone: "danger" as const,
      icon: Activity,
    },
    {
      label: "Incidentes abiertos",
      value: kpis?.openIncidents ?? 0,
      body: "Revisar severidad, deadline regulatorio y responsable de respuesta.",
      to: "/grc/incidentes",
      tone: "warning" as const,
      icon: AlertOctagon,
    },
    {
      label: "Excepciones pendientes",
      value: kpis?.pendingExceptions ?? 0,
      body: "Decidir si se aprueban, vencen o se transforman en plan.",
      to: "/grc/excepciones",
      tone: "warning" as const,
      icon: FileWarning,
    },
    {
      label: "Notificaciones reguladoras",
      value: kpis?.pendingRegNots ?? 0,
      body: "Confirmar ventana de notificación y evidencias mínimas.",
      to: "/grc/alertas",
      tone: "danger" as const,
      icon: Send,
    },
  ];
  const quickActions = [
    { label: "Abrir bandeja de trabajo", body: "Cola diaria de alertas, excepciones y tareas.", to: "/grc/mywork", icon: Briefcase },
    { label: "Registrar incidente", body: "Alta gestionada dentro de GRC Compass.", to: "/grc/incidentes/nuevo", icon: AlertOctagon },
    { label: "Crear riesgo", body: "Riesgo GRC con propietario y scoring.", to: "/grc/risk-360/nuevo", icon: Activity },
    { label: "Escalar a Secretaría", body: "Propuesta de solo lectura para agenda del órgano.", to: "/secretaria/reuniones/nueva?source=grc", icon: Route },
  ];

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Mesa de trabajo GRC
            </h1>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Compliance y riesgo operativo para Grupo ARGA Seguros: qué atender, qué flujo iniciar y qué queda solo como contexto técnico.
          </p>
        </div>
        <div className="flex w-fit flex-wrap items-center gap-2">
          <span
            className="bg-[var(--g-brand-3308)] px-2 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            Responsable: GRC Compass
          </span>
          <span
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-[11px] font-medium text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {isLoading ? "Cargando..." : "Lectura ejecutiva y cambios GRC"}
          </span>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
        <div
          className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
              Prioridad ahora
            </p>
            <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
              Riesgos, incidentes y plazos que requieren decisión
            </h2>
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {priorityItems.map((item) => {
              const Icon = item.icon;
              const valueClass = item.tone === "danger" ? "text-[var(--status-error)]" : "text-[var(--status-warning)]";
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
                      <span className={`text-sm font-bold tabular-nums ${valueClass}`}>{item.value}</span>
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
              Acciones operativas
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

      {/* KPIs */}
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Indicadores esenciales</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={Activity}
          label="Riesgos críticos"
          value={kpis?.criticalRisks}
          tone="danger"
        />
        <KpiCard
          icon={AlertOctagon}
          label="Incidentes abiertos"
          value={kpis?.openIncidents}
          tone="warning"
        />
        <KpiCard
          icon={AlertOctagon}
          label="Incidentes mayores"
          value={kpis?.majorOpen}
          tone="danger"
        />
        <KpiCard
          icon={FileWarning}
          label="Excepciones pendientes"
          value={kpis?.pendingExceptions}
          tone="warning"
        />
        <KpiCard
          icon={Send}
          label="Notif. reguladoras"
          value={kpis?.pendingRegNots}
          tone="danger"
        />
      </div>

      {/* P0 readiness */}
      <section
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-[var(--g-brand-3308)]" />
              <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
                Readiness ejecutivo P0
              </h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Dominios GRC ya navegables en la demo. La lectura separa operación diaria,
              rutas responsables y gaps todavía no conectados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Dominios", value: readiness.total },
              { label: "Listos", value: readiness.ready },
              { label: "En foco", value: readiness.watch },
              { label: "Rutas", value: readiness.connectedRoutes },
            ].map((item) => (
              <div
                key={item.label}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="text-xs font-medium text-[var(--g-text-secondary)]">
                  {item.label}
                </div>
                <div className="text-xl font-bold text-[var(--g-text-primary)]">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GRC_P0_DOMAINS.map((domain) => (
            <ReadinessDomainCard key={domain.id} domain={domain} />
          ))}
        </div>

        <div
          className="mt-4 flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 text-[var(--g-brand-3308)]" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Postura de fuentes
              </h3>
              <p className="text-sm leading-6 text-[var(--g-text-secondary)]">
                {readiness.connectedSources} dominios están conectados en la navegación GRC;{" "}
                {readiness.legacySources} dominios usan pantallas operativas ya disponibles para demo.
              </p>
            </div>
          </div>
          <Link
            to="/grc/mywork"
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Ver trabajo pendiente
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {GRC_NOT_CONNECTED_BACKLOG.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-[11px] font-medium text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
              title={item.reason}
            >
              No conectado ahora: {item.label}
            </span>
          ))}
        </div>
      </section>

      {/* Screen posture map */}
      <details
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Waypoints className="h-5 w-5 text-[var(--g-brand-3308)]" />
                <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
                  Contexto técnico y contratos
                </h2>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
                Inventario plegado para auditoría: fuentes, modo de operación y handoffs de solo lectura.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Pantallas", value: screenSummary.total },
                { label: "Solo lectura", value: screenSummary.byAccessMode["read-only"] },
                { label: "Cambios GRC", value: screenSummary.byAccessMode["owner-write"] },
                { label: "Backlog", value: screenSummary.byAccessMode.backlog },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="text-xs font-medium text-[var(--g-text-secondary)]">{item.label}</div>
                  <div className="text-xl font-bold text-[var(--g-text-primary)]">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </summary>

        <div className="mt-5 grid gap-3 md:hidden">
          {highlightedScreens.map((screen) => {
            const handoffs = screen.handoffCandidateIds.map(getGrcHandoffCandidate).filter(Boolean);
            return (
              <div
                key={screen.id}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{screen.label}</h3>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{screen.route}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center px-2 py-0.5 text-xs font-medium ${ACCESS_CHIP[screen.accessMode]}`}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {screen.accessMode}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--g-text-secondary)]">
                  {handoffs.length > 0 ? handoffs.map((handoff) => handoff?.contractEvent).join(", ") : "Sin handoff"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["Pantalla", "Ruta", "Fuente", "Modo", "Tablas / hooks", "Handoffs"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {highlightedScreens.map((screen) => {
                const handoffs = screen.handoffCandidateIds
                  .map(getGrcHandoffCandidate)
                  .filter(Boolean);

                return (
                  <tr key={screen.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--g-text-primary)]">{screen.label}</div>
                      <div className="text-xs text-[var(--g-text-secondary)]">Responsable: {screen.owner}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                      {screen.route}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {SOURCE_POSTURE_LABEL[screen.sourcePosture]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${ACCESS_CHIP[screen.accessMode]}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {screen.accessMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                      <div>{screen.tables.length ? screen.tables.join(", ") : "Sin tabla conectada"}</div>
                      <div className="mt-1">{screen.hooks.length ? screen.hooks.join(", ") : "Sin hook"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                      {handoffs.length > 0 ? handoffs.map((handoff) => handoff?.contractEvent).join(", ") : "Sin handoff"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className="mt-4 grid grid-cols-1 gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 lg:grid-cols-[1fr_1.4fr]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div>
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Backlog visible, no conectado
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {GRC_NOT_CONNECTED_BACKLOG.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-[11px] font-medium text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                  title={item.reason}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Handoffs de solo lectura
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {GRC_HANDOFF_CANDIDATES.map((handoff) => (
                <Link
                  key={handoff.id}
                  to={handoff.targetRoute}
                  className="flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs text-[var(--g-text-secondary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--g-brand-3308)]" />
                  <span>
                    <span className="font-semibold text-[var(--g-text-primary)]">{handoff.contractEvent}</span>
                    <span className="block">{handoff.sourceOwner} → {handoff.targetOwner}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Quick links grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Accesos rápidos */}
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
            Accesos rápidos
          </h2>
          <div className="space-y-2">
            {[
              { label: "Risk 360 global",              to: "/grc/risk-360" },
              { label: "Packs por País",               to: "/grc/packs" },
              { label: "Incidentes DORA",              to: "/grc/m/dora/operate/incidents" },
              { label: "Excepciones",                  to: "/grc/excepciones" },
              { label: "Alertas de deadline",          to: "/grc/alertas" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Módulos */}
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
            Módulos regulatorios
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "DORA / Resiliencia",   to: "/grc/m/dora",  sub: "4 ítems de compliance" },
              { label: "GDPR / Datos",         to: "/grc/m/gdpr",  sub: "3 ítems activos" },
              { label: "Ciberseguridad",       to: "/grc/m/cyber", sub: "3 CVEs abiertos" },
              { label: "Auditoría Interna",    to: "/grc/m/audit", sub: "Hallazgos vinculados" },
            ].map((mod) => (
              <Link
                key={mod.to}
                to={mod.to}
                className="flex flex-col gap-0.5 p-3 border border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span className="text-sm font-semibold text-[var(--g-text-primary)]">
                  {mod.label}
                </span>
                <span className="text-xs text-[var(--g-text-secondary)]">{mod.sub}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
