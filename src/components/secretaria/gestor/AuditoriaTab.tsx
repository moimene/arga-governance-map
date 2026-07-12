/**
 * AuditoriaTab — Trazabilidad operativa del gestor de plantillas.
 *
 * Combina:
 * - Overrides capa3 activos por entidad (`plantilla_capa3_overrides_por_entidad`).
 * - Changelog reciente (`plantilla_changelog`) con filtros por plantilla,
 *   actor, fecha y bump_type.
 * - Detector de plantillas huérfanas (sin changelog) usando
 *   `listOrphanTemplates` de `template-admin`.
 *
 * Absorbe el contenido de `pages/admin/PlantillasMantenimiento.tsx` para que
 * desaparezca como ruta independiente.
 *
 * Sprint 1 — Task 5.4 (auditoría).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Download, FolderOpen, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { EvidenceForenseSection } from "@/components/EvidenceForenseSection";
import { usePlantillaChangelog } from "@/hooks/secretaria/usePlantillaChangelog";
import {
  listOrphanTemplates,
  tipoLabel,
  estadoLabel,
} from "@/lib/secretaria/template-admin";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import {
  buildCsvFilename,
  downloadCsv,
  serializeCsv,
} from "@/lib/secretaria/csv-export";
import { mergeUrlSearchParams } from "@/lib/secretaria/template-configuration-routing";
import {
  CHANGELOG_CSV_COLUMNS,
  ORPHAN_CSV_COLUMNS,
  buildChangelogCsvRows,
  buildOrphanCsvRows,
  bumpTypeLabel,
  filterChangelogRows,
  logicalToVersion,
  type ChangelogRow,
} from "./auditoria-csv";

const FIVE_MINUTES = 5 * 60 * 1000;

type BumpType = "ALL" | "PATCH" | "MINOR" | "MAJOR";

type OverrideRow = {
  entity_id: string;
  plantilla_id: string;
  campo: string;
  compatible_with_canonical_version: string | null;
  motivo: string | null;
  created_at: string;
};

function changelogDateLabel(value: string | null): string {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "No disponible" : parsed.toLocaleDateString("es-ES");
}

function announceExportStatus(
  setter: (value: string) => void,
  message: string,
) {
  setter("");
  window.setTimeout(() => setter(message), 0);
}

function useOverridesActivos() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["auditoria_overrides_activos", tenantId],
    enabled: !!tenantId,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantilla_capa3_overrides_por_entidad")
        .select(
          "entity_id, plantilla_id, campo, compatible_with_canonical_version, motivo, created_at",
        )
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OverrideRow[];
    },
  });
}

export function AuditoriaTab() {
  const { tenantId } = useTenantContext();
  const [searchParams] = useSearchParams();
  const focusSinChangelog = searchParams.get("focus") === "sin-changelog";
  const overrides = useOverridesActivos();
  const changelog = usePlantillaChangelog();

  const orphanRows = useQuery({
    queryKey: ["auditoria_orphan_rows", tenantId],
    enabled: !!tenantId,
    staleTime: FIVE_MINUTES,
    queryFn: () => listOrphanTemplates(tenantId!),
  });

  const [filterPlantilla, setFilterPlantilla] = useState<string>("");
  const [filterActor, setFilterActor] = useState<string>("");
  const [filterBump, setFilterBump] = useState<BumpType>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [changelogExportStatus, setChangelogExportStatus] = useState("");
  const [orphanExportStatus, setOrphanExportStatus] = useState("");

  const changelogRows = useMemo(
    () => (changelog.data ?? []) as ChangelogRow[],
    [changelog.data],
  );

  const filteredChangelog = useMemo(() => {
    return filterChangelogRows(changelogRows, {
      plantilla: filterPlantilla,
      actor: filterActor,
      bump: filterBump,
      date: filterDate,
    });
  }, [changelogRows, filterPlantilla, filterActor, filterBump, filterDate]);

  const exportChangelog = () => {
    try {
      const content = serializeCsv(
        CHANGELOG_CSV_COLUMNS,
        buildChangelogCsvRows(filteredChangelog),
      );
      downloadCsv(
        content,
        buildCsvFilename(["secretaria", "changelog", "filtrado"]),
      );
      const count = filteredChangelog.length;
      announceExportStatus(
        setChangelogExportStatus,
        count === 1
          ? "Se ha exportado 1 entrada del changelog filtrado."
          : `Se han exportado ${count} entradas del changelog filtrado.`,
      );
    } catch {
      announceExportStatus(
        setChangelogExportStatus,
        "No se ha podido descargar el changelog filtrado. Inténtalo de nuevo.",
      );
    }
  };

  const exportOrphans = () => {
    try {
      const rows = orphanRows.data ?? [];
      const content = serializeCsv(ORPHAN_CSV_COLUMNS, buildOrphanCsvRows(rows));
      downloadCsv(
        content,
        buildCsvFilename(["secretaria", "plantillas", "sin-changelog"]),
      );
      const count = rows.length;
      announceExportStatus(
        setOrphanExportStatus,
        count === 1
          ? "Se ha exportado 1 plantilla sin changelog."
          : `Se han exportado ${count} plantillas sin changelog.`,
      );
    } catch {
      announceExportStatus(
        setOrphanExportStatus,
        "No se ha podido descargar la lista de plantillas sin changelog. Inténtalo de nuevo.",
      );
    }
  };

  const orphanCountLabel = orphanRows.isLoading
    ? "cargando"
    : orphanRows.isError
      ? "no disponible"
      : String(orphanRows.data?.length ?? 0);
  const changelogCountLabel = changelog.isLoading
    ? "cargando"
    : changelog.isError
      ? "no disponible"
      : `${filteredChangelog.length} de ${changelogRows.length}`;
  const overridesCountLabel = overrides.isLoading
    ? "cargando"
    : overrides.isError
      ? "no disponible"
      : String(overrides.data?.length ?? 0);
  const orphanExportFailed = orphanExportStatus.startsWith("No se ha podido");
  const changelogExportFailed = changelogExportStatus.startsWith("No se ha podido");

  return (
    <div className="space-y-6">
      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-label="Plantillas sin changelog"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Plantillas sin changelog ({orphanCountLabel})
          </h2>
          <button
            type="button"
            onClick={exportOrphans}
            disabled={
              orphanRows.isLoading
              || orphanRows.isFetching
              || orphanRows.isError
              || (orphanRows.data?.length ?? 0) === 0
            }
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-busy={orphanRows.isLoading || orphanRows.isFetching}
            aria-describedby="orphan-csv-note"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar plantillas sin changelog
          </button>
        </div>
        <p id="orphan-csv-note" className="mt-2 text-sm text-[var(--g-text-secondary)]">
          CSV de trabajo; el historial disponible es incompleto. La descarga refleja solo las
          plantillas en estados vivos que devuelve la comprobación actual.
        </p>
        <p
          className="mt-2 text-sm text-[var(--g-text-secondary)]"
          role={orphanExportFailed ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
        >
          {orphanExportStatus}
        </p>
        {orphanRows.isError ? (
          <div
            className="mt-3 flex flex-col gap-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <p className="text-sm text-[var(--g-text-primary)]">
              No se pudo comprobar la trazabilidad de changelog. El recuento no está disponible.
            </p>
            <button
              type="button"
              onClick={() => orphanRows.refetch()}
              disabled={orphanRows.isFetching}
              aria-busy={orphanRows.isFetching}
              className="inline-flex min-h-11 shrink-0 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Reintentar comprobación
            </button>
          </div>
        ) : (
          <details open={focusSinChangelog ? true : undefined}>
          <summary className="mt-2 flex min-h-11 cursor-pointer items-center text-sm font-medium text-[var(--g-link)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]">
            Ver detalle de plantillas sin changelog
          </summary>
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            Sin trazabilidad formal de cambios. Si se regulariza a posteriori, el changelog debe
            marcarse como reconstruido, no como original.
          </p>
          {orphanRows.isLoading ? (
            <p className="mt-3 text-sm text-[var(--g-text-secondary)]">Cargando…</p>
          ) : (orphanRows.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
              Todas las plantillas en estados vivos tienen al menos una entrada de changelog.
            </p>
          ) : (
            <div
              className="mt-3 max-h-[36rem] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              role="region"
              aria-label="Plantillas sin trazabilidad de cambios"
              tabIndex={0}
            >
              <table className="w-full text-sm border border-[var(--g-border-subtle)]">
                <thead className="sticky top-0 z-10 bg-[var(--g-surface-subtle)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Materia</th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Versión</th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Estado</th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {(orphanRows.data ?? []).map((o) => (
                    <tr key={o.id}>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{tipoLabel(o.tipo)}</td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                        {o.materia ? labelMateria(o.materia) : "—"}
                      </td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{o.version}</td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{estadoLabel(o.estado)}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={mergeUrlSearchParams(
                            `/secretaria/gestor-plantillas?tab=catalogo&plantilla=${o.id}`,
                            searchParams,
                          )}
                          aria-label={`Ver en catálogo: ${tipoLabel(o.tipo)} ${o.materia ? labelMateria(o.materia) : ""} v${o.version}`}
                          className="inline-flex min-h-11 items-center px-2 text-sm font-medium underline text-[var(--g-link)] hover:text-[var(--g-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          Ver en catálogo
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </details>
        )}
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Changelog reciente ({changelogCountLabel})
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={exportChangelog}
              disabled={
                changelog.isLoading
                || changelog.isFetching
                || changelog.isError
                || filteredChangelog.length === 0
              }
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={changelog.isLoading || changelog.isFetching}
              aria-describedby="changelog-csv-note"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar changelog filtrado
            </button>
            <button
              type="button"
              onClick={() => {
                setChangelogExportStatus("");
                changelog.refetch();
              }}
              disabled={changelog.isFetching}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:opacity-50 sm:w-auto"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={changelog.isFetching}
              aria-label="Recargar changelog"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Recargar
            </button>
          </div>
        </div>

        <p id="changelog-csv-note" className="mb-2 text-sm text-[var(--g-text-secondary)]">
          CSV de trabajo; el historial disponible es incompleto. Esta vista y su descarga contienen
          hasta 200 entradas recientes ya cargadas y respetan los filtros actuales.
        </p>
        <p
          className="mb-3 text-sm text-[var(--g-text-secondary)]"
          role={changelogExportFailed ? "alert" : "status"}
          aria-live="polite"
          aria-atomic="true"
        >
          {changelogExportStatus}
        </p>

        <div className="grid gap-3 mb-4 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Plantilla (id parcial)
            </span>
            <input
              type="search"
              value={filterPlantilla}
              onChange={(e) => {
                setFilterPlantilla(e.target.value);
                setChangelogExportStatus("");
              }}
              placeholder="ej. e3697ad9"
              className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Actor
            </span>
            <input
              type="search"
              value={filterActor}
              onChange={(e) => {
                setFilterActor(e.target.value);
                setChangelogExportStatus("");
              }}
              placeholder="ej. Comité Legal"
              className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Tipo de cambio
            </span>
            <select
              value={filterBump}
              onChange={(e) => {
                setFilterBump(e.target.value as BumpType);
                setChangelogExportStatus("");
              }}
              className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="ALL">Todos</option>
              <option value="PATCH">Corrección (PATCH)</option>
              <option value="MINOR">Evolución menor (MINOR)</option>
              <option value="MAJOR">Cambio mayor (MAJOR)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Fecha
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setChangelogExportStatus("");
              }}
              className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
        </div>

        {changelog.isLoading ? (
          <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>
        ) : changelog.isError ? (
          <p className="text-sm text-[var(--status-error)]" role="alert">
            No se pudo cargar el changelog. El recuento no está disponible; usa Recargar para reintentar.
          </p>
        ) : filteredChangelog.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <FolderOpen className="h-9 w-9 text-[var(--g-text-secondary)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-[var(--g-text-primary)]">
              Sin entradas para los filtros actuales.
            </p>
          </div>
        ) : (
          <div
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
            role="region"
            aria-label="Entradas del changelog de plantillas"
            tabIndex={0}
          >
            <table className="w-full text-sm border border-[var(--g-border-subtle)]">
              <thead className="bg-[var(--g-surface-subtle)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Plantilla</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Tipo de cambio</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Versión anterior → nueva</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Autor</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Motivo</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Cuándo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g-border-subtle)]">
                {filteredChangelog.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--g-text-secondary)]">
                      {c.plantilla_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                      {bumpTypeLabel(c.bump_type)}
                    </td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                      {c.from_version ?? "—"} → {logicalToVersion(c)}
                    </td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.autor}</td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.motivo ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                      {changelogDateLabel(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="text-base font-semibold text-[var(--g-text-primary)] mb-3">
          Ajustes de Capa 3 activos ({overridesCountLabel})
        </h2>
        {overrides.isLoading ? (
          <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>
        ) : overrides.isError ? (
          <div
            className="flex flex-col gap-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <p className="text-sm text-[var(--g-text-primary)]">
              No se pudieron cargar los ajustes de Capa 3. El recuento no está disponible.
            </p>
            <button
              type="button"
              onClick={() => overrides.refetch()}
              disabled={overrides.isFetching}
              aria-busy={overrides.isFetching}
              className="inline-flex min-h-11 shrink-0 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Reintentar ajustes
            </button>
          </div>
        ) : (overrides.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--g-text-secondary)]">
            Ninguna sociedad tiene ajustes sobre los campos editables de las plantillas.
          </p>
        ) : (
          <div
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
            role="region"
            aria-label="Ajustes de Capa 3 activos por sociedad"
            tabIndex={0}
          >
            <table className="w-full text-sm border border-[var(--g-border-subtle)]">
              <thead className="bg-[var(--g-surface-subtle)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Sociedad</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Plantilla</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Campo</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Compat. versión</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g-border-subtle)]">
                {(overrides.data ?? []).map((o) => (
                  <tr key={`${o.entity_id}-${o.plantilla_id}-${o.campo}`}>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--g-text-secondary)]">
                      {o.entity_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--g-text-secondary)]">
                      {o.plantilla_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{o.campo}</td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                      {o.compatible_with_canonical_version ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{o.motivo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-label="Evidencia forense general"
      >
        <details onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]">
            <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
            Evidencia forense general
          </summary>
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            Evidencias y cadena WORM del tenant. Se cargan solo al abrir esta sección porque no forman parte del changelog de plantillas.
          </p>
          {evidenceOpen ? (
            <div className="mt-4">
              <EvidenceForenseSection />
            </div>
          ) : null}
        </details>
      </section>
    </div>
  );
}
