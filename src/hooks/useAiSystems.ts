import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { pickPrimaryRiaSubject, type AimsRiaSubjectRow, type PrimaryRiaSubject } from "@/lib/aims/sujeto-escalado";

export type AiSystem = {
  id: string;
  tenant_id: string;
  name: string;
  system_type: string | null;
  risk_level: string | null;
  vendor: string | null;
  deployment_date: string | null;
  owner_id: string | null;
  status: string;
  description: string | null;
  use_case: string | null;
  /** Código de referencia AIMS opcional (legacy `ai_systems`). Surfaced by `EvaluacionNueva.tsx`. */
  aims_reference_code?: string | null;
  /**
   * Posición regulatoria de la entidad respecto al sistema (arts. 3.3, 3.4,
   * 3.6, 3.7 y 3.68 del Reglamento (UE) 2024/1689). Determina qué obligaciones
   * aplican. `null` en los sistemas anteriores al 2026-09-07.
   */
  regulatory_role?: string | null;
  /** Motivación con fecha y autor del rol y de la clasificación de riesgo. */
  regulatory_profile?: Record<string, unknown> | null;
  created_at: string;
};

// El guard del tenant va en la queryFn (`skipToken`), no en `enabled`:
// TanStack v5 EJECUTA la queryFn de una query deshabilitada cuando alguien
// llama a `refetch()` a mano. Con `enabled` a secas, ese refetch corría el
// `.eq("tenant_id", null)` y consultaba con el tenant sin resolver.
export function useAiSystemsList(riskFilter?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_systems", tenantId, riskFilter ?? "all"],
    queryFn: tenantId ? async () => {
      let q = supabase
        .from("ai_systems")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (riskFilter) q = q.eq("risk_level", riskFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AiSystem[];
    } : skipToken,
  });
}

export function useAiSystemById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_systems", tenantId, id],
    queryFn: tenantId && id ? async () => {
      const { data, error } = await supabase
        .from("ai_systems")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AiSystem;
    } : skipToken,
  });
}

export function useUpdateAiSystem() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AiSystem> }) => {
      const { data, error } = await supabase
        .from("ai_systems")
        .update(updates as unknown as TablesUpdate<"ai_systems">)
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as AiSystem;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["ai_systems"] });
      qc.invalidateQueries({ queryKey: ["ai_systems", tenantId, variables.id] });
    },
  });
}

/**
 * F2.T14 (MOI-170): sujeto RIA (PROVEEDOR con preferencia, si no el primero
 * vigente) de un sistema, para el escalado a Secretaría
 * (`EscaladoSecretariaModal.tsx`). Solo lectura sobre `aims_ria_subjects`
 * (F2.T2); `null` sin sujetos sembrados (hoy, la mayoría de los sistemas —
 * F2.T16 los siembra, fuera de este cambio).
 */
export function useAiSystemRiaSubject(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_ria_subjects", tenantId, "for-system", systemId ?? null],
    queryFn: tenantId && systemId ? async (): Promise<PrimaryRiaSubject | null> => {
      const { data, error } = await supabase
        .from("aims_ria_subjects")
        .select("entity_id, role, entity:entity_id(common_name)")
        .eq("tenant_id", tenantId!)
        .eq("system_id", systemId)
        .neq("status", "CERRADO");
      if (error) throw error;
      return pickPrimaryRiaSubject((data ?? []) as AimsRiaSubjectRow[]);
    } : skipToken,
  });
}
