import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface GovernanceModuleLink {
  id?: string;
  tenant_id: string;
  source_module: string;
  source_object_type: string;
  source_object_id: string;
  target_module: string;
  target_object_type: string | null;
  target_object_id: string | null;
  relation_type: string;
  status: "PROPOSED" | "ACTIVE" | "SUPERSEDED" | "CLOSED";
  evidence_bundle_id?: string | null;
  payload: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface GovernanceModuleEvent {
  id?: string;
  tenant_id: string;
  source_module: string;
  event_type: string;
  event_status: string;
  target_module?: string | null;
  source_object_type?: string | null;
  source_object_id?: string | null;
  target_object_type?: string | null;
  target_object_id?: string | null;
  evidence_bundle_id?: string | null;
  payload: Record<string, any>;
  created_at?: string;
}

export function useCrossModuleLinks(sourceModule: string, sourceObjectType: string, sourceObjectId: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["cross_module_links", tenantId, sourceModule, sourceObjectType, sourceObjectId],
    enabled: !!tenantId && !!sourceObjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("governance_module_links")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("source_module", sourceModule)
        .eq("source_object_type", sourceObjectType)
        .eq("source_object_id", sourceObjectId);
      if (error) throw error;
      return data as GovernanceModuleLink[];
    },
  });
}

export function useCreateModuleLink() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<GovernanceModuleLink, "tenant_id">) => {
      const { data, error } = await supabase
        .from("governance_module_links")
        .insert({ ...payload, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data as GovernanceModuleLink;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({
        queryKey: ["cross_module_links", tenantId, variables.source_module, variables.source_object_type, variables.source_object_id]
      });
    }
  });
}

export function useCreateModuleEvent() {
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (payload: Omit<GovernanceModuleEvent, "tenant_id">) => {
      const { data, error } = await supabase
        .from("governance_module_events")
        .insert({ ...payload, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data as GovernanceModuleEvent;
    }
  });
}
