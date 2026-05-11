/**
 * Página de mantenimiento del sistema v2 plantillas overrides.
 * Estado v2.0: lista pero NO enlazada en navegación. Se promueve a v2.1+
 * cuando el primer cliente real demanda. RBAC: solo ADMIN_TENANT.
 *
 * Spec §5.4.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

function useOverridesActivos() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["mantenimiento_overrides_activos", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantilla_capa3_overrides_por_entidad")
        .select("entity_id, plantilla_id, campo, compatible_with_canonical_version, motivo, created_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useChangelogReciente() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["mantenimiento_changelog", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantilla_changelog")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function PlantillasMantenimiento() {
  // RBAC simple: si no es ADMIN_TENANT, mostrar 403
  // (En v2.0 dejamos placeholder; integración real con useUserRole en v2.1+)
  const overrides = useOverridesActivos();
  const changelog = useChangelogReciente();

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">
          Mantenimiento de plantillas v2
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Vista admin (no enlazada en navegación en v2.0). RBAC pendiente: solo ADMIN_TENANT.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-medium text-[var(--g-text-primary)] mb-3">
          Overrides capa3 activos ({overrides.data?.length ?? 0})
        </h2>
        {overrides.isLoading && <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>}
        {!overrides.isLoading && (overrides.data?.length ?? 0) === 0 && (
          <p className="text-sm text-[var(--g-text-secondary)]">Sin overrides activos.</p>
        )}
        {overrides.data && overrides.data.length > 0 && (
          <table className="w-full text-sm border border-[var(--g-border-subtle)]">
            <thead className="bg-[var(--g-surface-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Entity</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Plantilla</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Campo</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Compat. version</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {overrides.data.map((o) => (
                <tr key={`${o.entity_id}-${o.plantilla_id}-${o.campo}`}>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)] font-mono text-xs">{o.entity_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)] font-mono text-xs">{o.plantilla_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{o.campo}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{o.compatible_with_canonical_version}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{o.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-[var(--g-text-primary)] mb-3">
          Changelog reciente ({changelog.data?.length ?? 0})
        </h2>
        {changelog.isLoading && <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>}
        {!changelog.isLoading && (changelog.data?.length ?? 0) === 0 && (
          <p className="text-sm text-[var(--g-text-secondary)]">Sin entradas todavía.</p>
        )}
        {changelog.data && changelog.data.length > 0 && (
          <table className="w-full text-sm border border-[var(--g-border-subtle)]">
            <thead className="bg-[var(--g-surface-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Plantilla</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Bump</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">From → To</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Autor</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Motivo</th>
                <th className="px-3 py-2 text-left text-[var(--g-text-primary)]">Cuándo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {changelog.data.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)] font-mono text-xs">{c.plantilla_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.bump_type}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.from_version ?? "—"} → {c.to_version}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.autor}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{c.motivo}</td>
                  <td className="px-3 py-2 text-[var(--g-text-secondary)]">{new Date(c.created_at).toLocaleDateString("es-ES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
