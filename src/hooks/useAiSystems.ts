import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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

export function useCreateAiSystem() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AiSystem>) => {
      const { data, error } = await supabase
        .from("ai_systems")
        .insert({ ...payload, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data as AiSystem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_systems"] }),
  });
}

export function useUpdateAiSystem() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AiSystem> }) => {
      const { data, error } = await supabase
        .from("ai_systems")
        .update(updates)
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

export function useDeleteAiSystem() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_systems")
        .delete()
        .eq("tenant_id", tenantId!)
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_systems"] }),
  });
}
