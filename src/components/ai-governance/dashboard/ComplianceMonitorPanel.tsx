import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  Cpu,
  Database,
  Eye,
  FileCheck2,
  Hand,
  ListChecks,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { AimsComplianceMonitorDomain } from "@/lib/aims/readiness";
import { ReadinessBadge } from "./ReadinessDomains";

const COMPLIANCE_MONITOR_ICONS: Record<string, React.ElementType> = {
  "governance-accountability": UserCheck,
  "inventory-classification": Database,
  "prohibited-practices": AlertTriangle,
  "high-risk-obligations": ClipboardCheck,
  "technical-documentation": FileCheck2,
  "data-governance": Database,
  "transparency-user-information": Eye,
  "human-oversight": Hand,
  "accuracy-robustness-cybersecurity": ShieldCheck,
  "provider-vendor-third-party": Cpu,
  "post-market-monitoring": Clock,
  "incident-reporting-escalation": AlertTriangle,
  "fundamental-rights-dpia": ShieldCheck,
  "iso-42001-management-system": ListChecks,
  "evidence-recordkeeping": FileCheck2,
};

export function ComplianceMonitorPanel({ monitors }: { monitors: AimsComplianceMonitorDomain[] }) {
  const summary = {
    ready: monitors.filter((monitor) => monitor.status === "ready").length,
    watch: monitors.filter((monitor) => monitor.status === "watch").length,
    gap: monitors.filter((monitor) => monitor.status === "gap").length,
  };

  return (
    <section
      className="mb-6 border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      aria-label="Monitor de cumplimiento AIMS"
    >
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
              Monitor de cumplimiento
            </p>
            <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
              Áreas AIMS que deben estar bajo vigilancia continua
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--g-text-secondary)]">
              La lectura se deriva de inventario, evaluaciones, controles de cumplimiento e incidentes. No crea controles GRC ni mueve el backbone `aims_*`.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="bg-[var(--status-success)] px-2.5 py-1 text-xs font-semibold text-[var(--g-text-inverse)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {summary.ready} listas
            </span>
            <span
              className="bg-[var(--status-warning)] px-2.5 py-1 text-xs font-semibold text-[var(--g-text-inverse)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {summary.watch} vigilancia
            </span>
            <span
              className="bg-[var(--status-error)] px-2.5 py-1 text-xs font-semibold text-[var(--g-text-inverse)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {summary.gap} gaps
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
        {monitors.map((monitor) => {
          const Icon = COMPLIANCE_MONITOR_ICONS[monitor.id] ?? ListChecks;
          return (
            <Link
              key={monitor.id}
              to={monitor.route}
              className="min-h-[154px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 transition-colors hover:border-[var(--g-brand-3308)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
                      {monitor.area}
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-[var(--g-text-primary)]">
                      {monitor.label}
                    </h3>
                  </div>
                </div>
                <ReadinessBadge status={monitor.status} />
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--g-text-secondary)]">
                {monitor.detail}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--g-text-primary)]">{monitor.metric}</span>
                <span
                  className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {monitor.source}
                </span>
                {monitor.handoff && (
                  <span
                    className="bg-[var(--g-surface-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    handoff
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
