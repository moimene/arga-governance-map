import { useGrcKpis } from "@/hooks/useGrcDashboard";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  FileWarning,
  Send,
  ArrowRight,
  Shield,
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

export default function GrcDashboard() {
  const { data: kpis, isLoading } = useGrcKpis();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              GRC Compass
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Vista global de riesgo, cumplimiento e incidentes · Grupo ARGA Seguros
          </p>
        </div>
        {isLoading && (
          <span className="text-xs text-[var(--g-text-secondary)] animate-pulse">
            Cargando…
          </span>
        )}
      </header>

      {/* KPIs */}
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
