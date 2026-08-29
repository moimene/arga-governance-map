import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  ai_systems?: { name: string; risk_level?: string | null } | null;
};

export function useAiIncidentsList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*, ai_systems(name, risk_level)")
        .eq("tenant_id", tenantId!)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiIncident[];
    },
  });
}

export function useAiIncidentById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*, ai_systems(name, risk_level)")
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AiIncident;
    },
    enabled: !!id && !!tenantId,
  });
}

export function useAiIncidentsBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiIncident[];
    },
    enabled: !!systemId && !!tenantId,
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

export function useDeleteAiIncident() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_incidents")
        .delete()
        .eq("tenant_id", tenantId!)
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_incidents"] });
    },
  });
}
