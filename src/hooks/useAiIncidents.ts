import { useMutation, useQuery, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type AiIncident = {
  id: string;
  tenant_id: string;
  system_id: string | null;
  title: string;
  severity: string | null;
  description: string | null;
  status: string;
  reported_at: string;
  closed_at: string | null;
  root_cause: string | null;
  corrective_action: string | null;
  /**
   * Perímetro regulatorio (2026-09-07). `null` = NO DECLARADO, que no es «no»:
   * el motor de relojes distingue los dos casos y con la clasificación sin
   * registrar advierte en vez de ocultar un plazo que puede aplicar.
   */
  incident_type?: string | null;
  ria_severity?: string | null;
  affects_personal_data?: boolean | null;
  high_risk_to_subjects?: boolean | null;
  affected_count?: number | null;
  ict_related?: boolean | null;
  affects_critical_function?: boolean | null;
  /** Cuándo se tuvo CONOCIMIENTO: es lo que arranca los plazos. */
  knowledge_at?: string | null;
  ai_systems?: { name: string; risk_level?: string | null } | null;
};

// El guard del tenant va en la queryFn (`skipToken`), no en `enabled`:
// TanStack v5 EJECUTA la queryFn de una query deshabilitada cuando alguien
// llama a `refetch()` a mano. Con `enabled` a secas, ese refetch corría el
// `.eq("tenant_id", null)` y consultaba con el tenant sin resolver.
export function useAiIncidentsList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, "all"],
    queryFn: tenantId ? async () => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*, ai_systems(name, risk_level)")
        .eq("tenant_id", tenantId!)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiIncident[];
    } : skipToken,
  });
}

export function useAiIncidentById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, id],
    queryFn: tenantId && id ? async () => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*, ai_systems(name, risk_level)")
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AiIncident;
    } : skipToken,
  });
}

export function useAiIncidentsBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiIncident[];
    } : skipToken,
  });
}

export function useCreateAiIncident() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AiIncident>) => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .insert({ ...payload, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data as AiIncident;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_incidents"] });
    },
  });
}

export function useUpdateAiIncident() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AiIncident> }) => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .update(updates)
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as AiIncident;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["ai_incidents"] });
      qc.invalidateQueries({ queryKey: ["ai_incidents", tenantId, variables.id] });
    },
  });
}
