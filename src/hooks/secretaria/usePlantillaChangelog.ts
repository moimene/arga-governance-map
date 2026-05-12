/**
 * Lectura del historial de changelog para una plantilla concreta o, si
 * no se pasa `plantillaId`, todas las del tenant (los 200 más recientes).
 *
 * Devuelve filas crudas de `plantilla_changelog` ordenadas por
 * `created_at` descendente. Las cards de la consola las consumen para
 * mostrar timeline + tooltips de `diff_summary`.
 *
 * Sprint 1 — Spec §7.4.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export function usePlantillaChangelog(plantillaId?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["plantilla_changelog", tenantId, plantillaId ?? "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("plantilla_changelog")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (plantillaId) q = q.eq("plantilla_id", plantillaId);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}
