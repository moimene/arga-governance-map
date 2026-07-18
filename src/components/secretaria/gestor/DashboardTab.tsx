/**
 * DashboardTab — Resumen ejecutivo de la consola del Gestor de Plantillas.
 *
 * Muestra:
 * - 6 KPIs accionables (total activas, cobertura core v1.0, P0 activos,
 *   borradores pendientes, huérfanos sin changelog, última actividad).
 * - Cola unificada de incidencias jurídicas, de cobertura, Gate PRE y
 *   trazabilidad, agrupada por concepto.
 * - Acciones rápidas para saltar a Importar / Cobertura / Auditoría /
 *   Validación.
 *
 * Empty state si el tenant aún no tiene plantillas: CTA único a Importar.
 *
 * Sprint 1 — Task 5.3.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Plus, Search, FolderOpen, ShieldCheck } from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";
import {
  usePlantillasProtegidas,
} from "@/hooks/usePlantillasProtegidas";
import { usePlantillaChangelog } from "@/hooks/secretaria/usePlantillaChangelog";
import { buildLegalTemplateCoverage } from "@/lib/secretaria/legal-template-coverage";
import { buildLegalTemplateReviewRows } from "@/lib/secretaria/legal-template-review";
import {
  buildTemplateLayerGateCandidate,
  normalizeCapa2Rows,
  normalizeCapa3Rows,
} from "@/lib/secretaria/template-layer-ux";
import {
  buildTemplateGovernanceIncidents,
  type TemplateGovernanceIncident,
} from "@/lib/secretaria/template-governance-ux";
import {
  computeCoreCoverage,
  countOrphanTemplates,
  CORE_V1_MATERIAS_COUNT,
  KNOWN_P0_TEMPLATE_IDS,
  validateTemplateForActivation,
} from "@/lib/secretaria/template-admin";
import { KpiCard } from "./KpiCard";
import { useTabAccess, type TabId } from "./tab-guards";
import { ConfigurationLoadError } from "@/components/secretaria/ConfigurationLoadError";
import { mergeUrlSearchParams } from "@/lib/secretaria/template-configuration-routing";

const FIVE_MINUTES = 5 * 60 * 1000;

const INCIDENT_BADGE_CLASS = {
  ERROR:
    "border border-[var(--status-error)] bg-[var(--status-error)]/10 text-[var(--g-text-primary)]",
  WARNING:
    "border border-[var(--status-warning)] bg-[var(--status-warning)]/10 text-[var(--g-text-primary)]",
  INFO:
    "border border-[var(--status-info)] bg-[var(--status-info)]/10 text-[var(--g-text-primary)]",
} as const;

const INCIDENT_BORDER_CLASS = {
  ERROR: "border-l-[var(--status-error)]",
  WARNING: "border-l-[var(--status-warning)]",
  INFO: "border-l-[var(--status-info)]",
} as const;

function incidentDestination(incident: TemplateGovernanceIncident) {
  if (!incident.firstTemplateId || !incident.destination.includes("tab=catalogo")) {
    return incident.destination;
  }
  const separator = incident.destination.includes("?") ? "&" : "?";
  return `${incident.destination}${separator}plantilla=${encodeURIComponent(incident.firstTemplateId)}`;
}

function incidentCtaLabel(incident: TemplateGovernanceIncident) {
  if (incident.destination.includes("tab=cobertura")) return "Revisar cobertura";
  if (incident.destination.includes("tab=auditoria")) return "Revisar trazabilidad";
  return incident.firstTemplateId ? "Abrir primera plantilla" : "Revisar en catálogo";
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function DashboardTab() {
  const { tenantId, isLoading: tenantLoading } = useTenantContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canAccess } = useTabAccess();
  const plantillas = usePlantillasProtegidas();
  const changelog = usePlantillaChangelog();

  const coverage = useQuery({
    queryKey: ["dashboard", "coverage", tenantId],
    enabled: !!tenantId,
    queryFn: () => computeCoreCoverage(tenantId!),
    staleTime: FIVE_MINUTES,
  });

  const orphans = useQuery({
    queryKey: ["dashboard", "orphans", tenantId],
    enabled: !!tenantId,
    queryFn: () => countOrphanTemplates(tenantId!),
    staleTime: FIVE_MINUTES,
  });

  const rows = useMemo(() => plantillas.data ?? [], [plantillas.data]);
  const activas = rows.filter((r) => r.estado === "ACTIVA");
  const borradores = rows.filter((r) => r.estado === "BORRADOR");
  const lastEntry = changelog.data?.[0];

  const activeGateCandidates = useMemo(
    () =>
      rows
        .filter((row) => row.estado === "ACTIVA")
        .map((row) =>
          buildTemplateLayerGateCandidate(
            row,
            row.capa1_inmutable ?? "",
            normalizeCapa2Rows(row.capa2_variables),
            normalizeCapa3Rows(row.capa3_editables),
          ),
        ),
    [rows],
  );
  const effectiveTenantId = tenantId ?? activas[0]?.tenant_id ?? "";
  const legalReviewRows = useMemo(() => buildLegalTemplateReviewRows(rows), [rows]);
  const extendedCoverage = useMemo(() => buildLegalTemplateCoverage(rows), [rows]);
  const gateIssuesByTemplate = useMemo(
    () =>
      new Map(
        activeGateCandidates.map((candidate) => [
          candidate.id,
          validateTemplateForActivation(candidate, {
            tenantId: effectiveTenantId,
            existingActiveTemplates: activeGateCandidates,
          }).issues,
        ]),
      ),
    [activeGateCandidates, effectiveTenantId],
  );
  const incidents = useMemo(
    () =>
      buildTemplateGovernanceIncidents({
        templates: rows,
        legalReviewRows,
        extendedCoverage,
        coreGaps: coverage.data?.gaps ?? [],
        coreGapCount: coverage.data?.gaps.length ?? 0,
        orphanCount: orphans.data ?? 0,
        gateIssuesByTemplate,
        p0TemplateIds: KNOWN_P0_TEMPLATE_IDS,
      }),
    [
      coverage.data?.gaps,
      extendedCoverage,
      gateIssuesByTemplate,
      legalReviewRows,
      orphans.data,
      rows,
    ],
  );

  const goto = (tab: TabId) =>
    navigate(
      mergeUrlSearchParams(`/secretaria/gestor-plantillas?tab=${tab}`, searchParams),
      { replace: false },
    );

  if (plantillas.isError || changelog.isError || coverage.isError || orphans.isError) {
    return (
      <ConfigurationLoadError
        title="No se ha podido calcular la salud documental."
        detail="Los indicadores y alertas se ocultan para no mostrar ceros derivados de una carga incompleta."
        onRetry={() => {
          void Promise.all([
            plantillas.refetch(),
            changelog.refetch(),
            coverage.refetch(),
            orphans.refetch(),
          ]);
        }}
        retrying={
          plantillas.isFetching || changelog.isFetching || coverage.isFetching || orphans.isFetching
        }
      />
    );
  }

  const configurationLoading =
    tenantLoading ||
    plantillas.isPending ||
    changelog.isPending ||
    coverage.isPending ||
    orphans.isPending;

  if (rows.length === 0 && !configurationLoading) {
    return (
      <div className="p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-[var(--g-text-secondary)] mb-4" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[var(--g-text-primary)] mb-2">
          Catálogo vacío
        </h2>
        <p className="text-sm text-[var(--g-text-secondary)] mb-6">
          Aún no hay plantillas protegidas en este tenant.
        </p>
        {canAccess("importar") ? (
          <button
            type="button"
            onClick={() => goto("importar")}
            className="min-h-11 bg-[var(--g-brand-3308)] px-6 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Importar tus primeras plantillas
          </button>
        ) : (
          <p className="text-sm text-[var(--g-text-secondary)]">
            Un administrador del tenant debe importar la primera plantilla.
          </p>
        )}
      </div>
    );
  }

  const orphansCount = orphans.data ?? 0;
  const covered = coverage.data?.covered ?? CORE_V1_MATERIAS_COUNT;
  const healthLoading = configurationLoading;
  const errorCount = incidents.filter((incident) => incident.severity === "ERROR").length;
  const warningCount = incidents.filter((incident) => incident.severity === "WARNING").length;
  const hasErrors = errorCount > 0;
  const hasWarnings = warningCount > 0;
  const healthDot = healthLoading
    ? "bg-[var(--g-surface-muted)]"
    : hasErrors
      ? "bg-[var(--status-error)]"
      : hasWarnings
        ? "bg-[var(--status-warning)]"
        : "bg-[var(--status-success)]";
  const healthLabel = healthLoading
    ? "Evaluando"
    : hasErrors
      ? "Con incidencias"
      : hasWarnings
        ? "Con advertencias"
        : "Operativo";
  const healthPhrase = healthLoading
    ? "Evaluando la salud documental de la biblioteca…"
    : hasErrors || hasWarnings
      ? `La biblioteca requiere atención: ${countLabel(errorCount, "incidencia", "incidencias")}, ${countLabel(warningCount, "advertencia", "advertencias")}, cobertura obligatoria ${covered}/${CORE_V1_MATERIAS_COUNT} y ${countLabel(orphansCount, "plantilla sin historial de cambios", "plantillas sin historial de cambios")}.`
      : `Gobierno documental operativo: ${activas.length} plantillas vigentes, cobertura obligatoria completa y trazabilidad al día.`;

  return (
    <div className="space-y-6">
      <section
        aria-label="Salud documental"
        className="flex flex-wrap items-center gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-5 py-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <span
          className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 ${healthDot}`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          />
          {healthLabel}
        </span>
        <p className="flex-1 min-w-[220px] text-sm text-[var(--g-text-primary)]">
          {healthPhrase}
        </p>
      </section>

      {!healthLoading && incidents.length > 0 ? (
        <section className="space-y-3" aria-labelledby="incident-queue-heading">
          <div>
            <h2
              id="incident-queue-heading"
              className="text-base font-semibold text-[var(--g-text-primary)]"
            >
              Cola de incidencias
            </h2>
            <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
              Hallazgos consolidados de la biblioteca documental, ordenados por severidad.
            </p>
          </div>
          <div className="space-y-3">
            {incidents.map((incident) => (
              <article
                key={incident.id}
                className={`border border-l-4 border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 ${INCIDENT_BORDER_CLASS[incident.severity]}`}
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold ${INCIDENT_BADGE_CLASS[incident.severity]}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {incident.severity === "ERROR"
                          ? "Incidencia"
                          : incident.severity === "WARNING"
                            ? "Advertencia"
                            : "Información"}
                      </span>
                      <span className="text-xs font-medium text-[var(--g-text-secondary)]">
                        {incident.affected} {incident.affected === 1 ? "elemento afectado" : "elementos afectados"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">
                      {incident.title}
                    </h3>
                    <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <div>
                        <dt className="font-medium text-[var(--g-text-primary)]">Consecuencia</dt>
                        <dd className="mt-0.5 text-[var(--g-text-secondary)]">
                          {incident.consequence}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-[var(--g-text-primary)]">Acción recomendada</dt>
                        <dd className="mt-0.5 text-[var(--g-text-secondary)]">
                          {incident.action}
                        </dd>
                      </div>
                    </dl>
                    {incident.technicalCodes.length > 0 ? (
                      <details className="mt-3 text-xs text-[var(--g-text-secondary)]">
                        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
                          Información técnica
                        </summary>
                        <p className="break-words pb-1 font-mono">
                          {incident.technicalCodes.join(" · ")}
                        </p>
                      </details>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        mergeUrlSearchParams(incidentDestination(incident), searchParams),
                        { replace: false },
                      )
                    }
                    className="min-h-11 shrink-0 border border-[var(--g-border-default)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-label={`${incidentCtaLabel(incident)}: ${incident.title}`}
                  >
                    {incidentCtaLabel(incident)}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total activas"
          value={activas.length}
          tone="neutral"
          sublabel="Volumen, no salud documental"
          onClick={() => goto("catalogo")}
        />
        <KpiCard
          label="Cobertura obligatoria"
          value={`${coverage.data?.covered ?? 0}/${CORE_V1_MATERIAS_COUNT}`}
          tone={
            (coverage.data?.covered ?? 0) === CORE_V1_MATERIAS_COUNT
              ? "success"
              : "warning"
          }
          sublabel="Combinaciones órgano · materia"
          onClick={() => goto("cobertura")}
        />
        {/* Lote 2 coherencia (glosario): Incidencia = severidad ERROR de los
            detectores vivos — antes contaba la allowlist KNOWN_P0 (vacía),
            clavando el KPI a 0 mientras la cabecera decía "Con incidencias". */}
        <KpiCard
          label="Incidencias"
          value={errorCount}
          tone={errorCount > 0 ? "warning" : "success"}
          sublabel="Grupos con severidad de incidencia"
          onClick={() => goto("catalogo")}
        />
        <KpiCard
          label="Borradores pendientes"
          value={borradores.length}
          tone="neutral"
          sublabel="Plantillas en BORRADOR"
          onClick={() => goto("catalogo")}
        />
        <KpiCard
          label="Sin historial de cambios"
          value={orphansCount}
          tone={orphansCount > 0 ? "warning" : "success"}
          sublabel="Plantillas huérfanas"
          onClick={() => goto("auditoria")}
        />
        <KpiCard
          label="Última actividad"
          value={
            lastEntry
              ? new Date(lastEntry.created_at).toLocaleDateString("es-ES")
              : "—"
          }
          tone="neutral"
          sublabel="Último cambio registrado"
          onClick={() => goto("auditoria")}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--g-text-secondary)] mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {canAccess("importar") ? (
            <button
              type="button"
              onClick={() => goto("importar")}
              className="flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-3 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Importar plantilla
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => goto("cobertura")}
            className="flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] px-4 py-3 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Search className="h-4 w-4" aria-hidden="true" /> Cobertura por materia y órgano
          </button>
          <button
            type="button"
            onClick={() => goto("auditoria")}
            className="flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] px-4 py-3 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" /> Auditoría e historial de cambios
          </button>
          {canAccess("validacion") ? (
            <button
              type="button"
              onClick={() => goto("validacion")}
              className="flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] px-4 py-3 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Comprobación documental
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
