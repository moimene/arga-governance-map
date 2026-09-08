import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCheck2,
  GitBranch,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import type { AimsReadinessDomain, AimsReadinessStatus, AimsReadinessSummary } from "@/lib/aims/readiness";
import { HandoffAffordances } from "./HandoffAffordances";

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

export function ReadinessBadge({ status }: { status: AimsReadinessStatus }) {
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

export interface ReadinessDomainsProps {
  readiness: AimsReadinessSummary;
  /**
   * El veredicto, ya redactado por la página a partir de
   * `readiness.standaloneReady`. Se recibe hecho porque quien afirma que la
   * demo está lista es la pantalla que tiene el resumen delante, no el bloque
   * que lo pinta; aquí sólo se elige con qué color se enseña.
   */
  veredicto: string;
  /** Filas de cada fuente. Con las tres a cero no se afirma que haya datos. */
  totalSistemas: number;
  totalEvaluaciones: number;
  totalIncidentes: number;
}

export function ReadinessDomains({
  readiness,
  veredicto,
  totalSistemas,
  totalEvaluaciones,
  totalIncidentes,
}: ReadinessDomainsProps) {
  const sinFuentes = totalSistemas + totalEvaluaciones + totalIncidentes === 0;
  return (
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
            {/* Era incondicional y contradecía al propio resumen: hoy se pinta
                el veredicto que `buildAimsReadiness` calcula. */}
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 ${
                readiness.standaloneReady
                  ? "text-[var(--g-text-inverse)] bg-[var(--g-brand-3308)]"
                  : "text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] border border-[var(--g-border-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {veredicto}
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
            {/* «datos demo conectados» era incondicional: con las tres fuentes
                vacías seguía afirmando que había datos. */}
            Estado de fuentes:{" "}
            {sinFuentes
              ? "sin datos en las tres fuentes"
              : `${totalSistemas} sistemas · ${totalEvaluaciones} evaluaciones · ${totalIncidentes} incidentes`}
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
              {/* «sin schema nuevo» era falso —las tablas `aims_*` existen desde
                  abril— y además contradecía al dominio `migration` del propio
                  resumen, que dice «No medido». */}
              <dd className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">No medido en este resumen</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--g-text-secondary)] leading-relaxed">
            Este panel es de solo lectura sobre <code>ai_*</code>. El backbone <code>aims_*</code> existe y lo
            usan otras pantallas del módulo, pero su estado no se mide aquí.
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

      <HandoffAffordances />
    </div>
  );
}
