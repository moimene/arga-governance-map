/**
 * AuditoriaTab — Trazabilidad operativa del gestor de plantillas.
 *
 * Combina:
 * - Overrides capa3 activos por entidad (`plantilla_capa3_overrides_por_entidad`).
 * - Changelog reciente (`plantilla_changelog`) con filtros por plantilla,
 *   actor, fecha y bump_type.
 * - Detector de plantillas huérfanas (sin changelog) usando
 *   `countOrphanTemplates` de `template-admin`.
 *
 * Absorbe el contenido de `pages/admin/PlantillasMantenimiento.tsx` para que
 * desaparezca como ruta independiente.
 *
 * Sprint 1 — Task 5.4 (auditoría).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FolderOpen, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { EvidenceForenseSection } from "@/components/EvidenceForenseSection";
import { usePlantillaChangelog } from "@/hooks/secretaria/usePlantillaChangelog";
import { countOrphanTemplates } from "@/lib/secretaria/template-admin";
import { AlertBanner } from "./AlertBanner";

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

type ChangelogRow = {
  id: string;
  plantilla_id: string;
  bump_type: string | null;
  motivo: string | null;
  diff_summary: string | null;
  from_version: string | null;
  to_version: string;
  autor: string;
  created_at: string;
};

function logicalToVersion(row: ChangelogRow): string {
  if (row.diff_summary) {
    try {
      const parsed = JSON.parse(row.diff_summary) as { logical_to_version?: unknown };
      if (typeof parsed.logical_to_version === "string") return parsed.logical_to_version;
    } catch {
      // `diff_summary` existed before the JSON text convention; fall back below.
    }
  }
  return row.to_version.split("#idemp:")[0] ?? row.to_version;
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
  const overrides = useOverridesActivos();
  const changelog = usePlantillaChangelog();

  const orphans = useQuery({
    queryKey: ["auditoria_orphans", tenantId],
    enabled: !!tenantId,
    staleTime: FIVE_MINUTES,
    queryFn: () => countOrphanTemplates(tenantId!),
  });

  const [filterPlantilla, setFilterPlantilla] = useState<string>("");
  const [filterActor, setFilterActor] = useState<string>("");
  const [filterBump, setFilterBump] = useState<BumpType>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");

  const changelogRows = useMemo(
    () => (changelog.data ?? []) as ChangelogRow[],
    [changelog.data],
  );

  const filteredChangelog = useMemo(() => {
    return changelogRows.filter((row) => {
      if (filterPlantilla && !row.plantilla_id.toLowerCase().includes(filterPlantilla.toLowerCase())) {
        return false;
      }
      if (filterActor && !row.autor.toLowerCase().includes(filterActor.toLowerCase())) {
        return false;
      }
      if (filterBump !== "ALL" && row.bump_type !== filterBump) {
        return false;
      }
      if (filterDate) {
        const created = row.created_at.slice(0, 10);
        if (created !== filterDate) return false;
      }
      return true;
    });
  }, [changelogRows, filterPlantilla, filterActor, filterBump, filterDate]);

  const orphansCount = orphans.data ?? 0;

  return (
    <div className="space-y-6">
      {orphansCount > 0 ? (
        <AlertBanner
          tipo="WARNING"
          mensaje={`${orphansCount} plantilla(s) sin changelog detectadas. Revisar trazabilidad.`}
        />
      ) : null}

      {/* ITEM-111: verificación de la cadena WORM + bundles de evidencia forense.
          El componente estaba huérfano (ninguna ruta lo montaba); ahora que la
          cadena verifica (chain_valid=true tras ITEM-045) se expone en Auditoría. */}
      <EvidenceForenseSection />

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="text-base font-semibold text-[var(--g-text-primary)] mb-3">
          Overrides capa3 activos ({overrides.data?.length ?? 0})
        </h2>
        {overrides.isLoading ? (
          <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>
        ) : (overrides.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--g-text-secondary)]">Sin overrides activos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[var(--g-border-subtle)]">
              <thead className="bg-[var(--g-surface-subtle)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Entity</th>
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
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Changelog reciente ({filteredChangelog.length} de {changelogRows.length})
          </h2>
          <button
            type="button"
            onClick={() => changelog.refetch()}
            disabled={changelog.isFetching}
            className="flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50 transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-busy={changelog.isFetching}
            aria-label="Recargar changelog"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Recargar
          </button>
        </div>

        <div className="grid gap-3 mb-4 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Plantilla (id parcial)
            </span>
            <input
              type="search"
              value={filterPlantilla}
              onChange={(e) => setFilterPlantilla(e.target.value)}
              placeholder="ej. e3697ad9"
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
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
              onChange={(e) => setFilterActor(e.target.value)}
              placeholder="ej. Comité Legal"
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Bump type
            </span>
            <select
              value={filterBump}
              onChange={(e) => setFilterBump(e.target.value as BumpType)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="ALL">Todos</option>
              <option value="PATCH">PATCH</option>
              <option value="MINOR">MINOR</option>
              <option value="MAJOR">MAJOR</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 text-xs font-medium text-[var(--g-text-secondary)]">
              Fecha (YYYY-MM-DD)
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
        </div>

        {changelog.isLoading ? (
          <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>
        ) : filteredChangelog.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <FolderOpen className="h-9 w-9 text-[var(--g-text-secondary)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-[var(--g-text-primary)]">
              Sin entradas para los filtros actuales.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-[var(--g-border-subtle)]">
              <thead className="bg-[var(--g-surface-subtle)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Plantilla</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">Bump</th>
                  <th className="px-3 py-2 text-left font-medium text-[var(--g-text-primary)]">From → To</th>
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
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.bump_type ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                      {c.from_version ?? "—"} → {logicalToVersion(c)}
                    </td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.autor}</td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.motivo ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--g-text-secondary)]">
                      {new Date(c.created_at).toLocaleDateString("es-ES")}
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
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`h-4 w-4 ${orphansCount > 0 ? "text-[var(--status-warning)]" : "text-[var(--status-success)]"}`}
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
            Huérfanos sin changelog
          </h2>
        </div>
        <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
          {orphans.isLoading
            ? "Calculando…"
            : orphansCount === 0
              ? "Todas las plantillas del tenant tienen al menos una entrada en `plantilla_changelog`."
              : `${orphansCount} plantilla(s) sin entrada en \`plantilla_changelog\`. Probable carga manual previa al servicio de transición.`}
        </p>
      </section>
    </div>
  );
}
