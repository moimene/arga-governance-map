/**
 * DashboardTab — Resumen ejecutivo de la consola del Gestor de Plantillas.
 *
 * Muestra:
 * - 6 KPIs accionables (total activas, cobertura core v1.0, P0 activos,
 *   borradores pendientes, huérfanos sin changelog, última actividad).
 * - Alertas ERROR/WARNING jerárquicas (cobertura incompleta, P0
 *   pendientes, huérfanos).
 * - Acciones rápidas para saltar a Importar / Cobertura / Auditoría /
 *   Validación.
 *
 * Empty state si el tenant aún no tiene plantillas: CTA único a Importar.
 *
 * Sprint 1 — Task 5.3.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Search, FolderOpen, ShieldCheck } from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { usePlantillaChangelog } from "@/hooks/secretaria/usePlantillaChangelog";
import {
  computeCoreCoverage,
  countOrphanTemplates,
  CORE_V1_MATERIAS_COUNT,
  KNOWN_P0_TEMPLATE_IDS,
} from "@/lib/secretaria/template-admin";
import { KpiCard } from "./KpiCard";
import { AlertBanner } from "./AlertBanner";
import { useTabAccess, type TabId } from "./tab-guards";

const FIVE_MINUTES = 5 * 60 * 1000;

type DashboardAlert = {
  tipo: "ERROR" | "WARNING" | "INFO";
  mensaje: string;
  tab: TabId;
  /** Ruta completa a navegar desde el CTA (con query params extra); si falta, se usa `tab`. */
  to?: string;
};

export function DashboardTab() {
  const { tenantId } = useTenantContext();
  const navigate = useNavigate();
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

  const rows = plantillas.data ?? [];
  const activas = rows.filter((r) => r.estado === "ACTIVA");
  const borradores = rows.filter((r) => r.estado === "BORRADOR");
  const p0Activas = activas.filter((r) => KNOWN_P0_TEMPLATE_IDS.has(r.id));
  const lastEntry = changelog.data?.[0];

  const goto = (tab: TabId) =>
    navigate(`/secretaria/gestor-plantillas?tab=${tab}`, { replace: false });

  if (rows.length === 0 && !plantillas.isLoading) {
    return (
      <div className="p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-[var(--g-text-secondary)] mb-4" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[var(--g-text-primary)] mb-2">
          Catálogo vacío
        </h2>
        <p className="text-sm text-[var(--g-text-secondary)] mb-6">
          Aún no hay plantillas protegidas en este tenant.
        </p>
        <button
          type="button"
          onClick={() => goto("importar")}
          className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-6 py-2 text-sm font-medium"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Importar tus primeras plantillas
        </button>
      </div>
    );
  }

  const alerts: DashboardAlert[] = [];
  const orphansCount = orphans.data ?? 0;
  if (orphansCount > 0) {
    alerts.push({
      tipo: "WARNING",
      mensaje: `${orphansCount} plantilla(s) sin changelog — revisar Auditoría`,
      tab: "auditoria",
      to: "/secretaria/gestor-plantillas?tab=auditoria&focus=sin-changelog",
    });
  }
  if (p0Activas.length > 0) {
    alerts.push({
      tipo: "ERROR",
      mensaje: `${p0Activas.length} plantilla(s) activa(s) con P0 conocido pendiente Comité Legal`,
      tab: "catalogo",
    });
  }
  const covered = coverage.data?.covered ?? CORE_V1_MATERIAS_COUNT;
  if (covered < CORE_V1_MATERIAS_COUNT) {
    alerts.push({
      tipo: "ERROR",
      mensaje: `Cobertura core v1.0 incompleta: ${covered}/${CORE_V1_MATERIAS_COUNT}`,
      tab: "cobertura",
    });
  }

  const hasAlerts = alerts.length > 0;
  // La lectura ejecutiva respeta el tipo real de las alertas (una ERROR no se
  // resume como "advertencias") y no afirma salud completa mientras
  // cobertura/huérfanas siguen cargando.
  const healthLoading = plantillas.isLoading || coverage.isLoading || orphans.isLoading;
  const hasErrorAlert = alerts.some((a) => a.tipo === "ERROR");
  const healthDot = healthLoading
    ? "bg-[var(--g-surface-muted)]"
    : hasErrorAlert
      ? "bg-[var(--status-error)]"
      : hasAlerts
        ? "bg-[var(--status-warning)]"
        : "bg-[var(--status-success)]";
  const healthLabel = healthLoading
    ? "Evaluando"
    : hasErrorAlert
      ? "Con incidencias"
      : hasAlerts
        ? "Con advertencias"
        : "Operativo";
  const healthPhrase = healthLoading
    ? "Evaluando la salud documental de la biblioteca…"
    : hasAlerts
      ? `Gobierno documental operativo ${hasErrorAlert ? "con incidencias" : "con advertencias"}: ${activas.length} plantillas vigentes, cobertura core ${covered}/${CORE_V1_MATERIAS_COUNT} y ${orphansCount} sin changelog.`
      : `Gobierno documental operativo: ${activas.length} plantillas vigentes, cobertura core completa y trazabilidad al día.`;

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

      {alerts.length > 0 ? (
        <section className="space-y-2" aria-label="Alertas del gestor">
          {alerts.map((a, i) => (
            <AlertBanner
              key={`${a.tab}-${i}`}
              tipo={a.tipo}
              mensaje={a.mensaje}
              cta={{
                label: "Ver",
                onClick: () => (a.to ? navigate(a.to, { replace: false }) : goto(a.tab)),
              }}
            />
          ))}
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
          label="Cobertura core v1.0"
          value={`${coverage.data?.covered ?? 0}/${CORE_V1_MATERIAS_COUNT}`}
          tone={
            (coverage.data?.covered ?? 0) === CORE_V1_MATERIAS_COUNT
              ? "success"
              : "warning"
          }
          sublabel="Combinaciones órgano · materia"
          onClick={() => goto("cobertura")}
        />
        <KpiCard
          label="P0 activos"
          value={p0Activas.length}
          tone={p0Activas.length > 0 ? "warning" : "success"}
          sublabel="Plantillas con P0 conocido"
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
          label="Sin changelog"
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
              className="flex items-center gap-2 px-4 py-3 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Importar plantilla
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => goto("cobertura")}
            className="flex items-center gap-2 px-4 py-3 border border-[var(--g-border-default)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Search className="h-4 w-4" aria-hidden="true" /> Cobertura legal
          </button>
          <button
            type="button"
            onClick={() => goto("auditoria")}
            className="flex items-center gap-2 px-4 py-3 border border-[var(--g-border-default)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" /> Auditoría
          </button>
          {canAccess("validacion") ? (
            <button
              type="button"
              onClick={() => goto("validacion")}
              className="flex items-center gap-2 px-4 py-3 border border-[var(--g-border-default)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Comprobación documental global
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
