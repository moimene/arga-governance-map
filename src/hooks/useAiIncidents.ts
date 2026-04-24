import { useQuery } from "@tanstack/react-query";
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
  ai_systems?: { name: string } | null;
};

export function useAiIncidentsList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_incidents", tenantId, "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_incidents")
        .select("*, ai_systems(name)")
        .eq("tenant_id", tenantId!)
        .order("reported_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiIncident[];
    },
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
