import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

// ============================================================
// Cross-module links — SOLO LECTURA
// ============================================================
// Guardrail CLAUDE.md: "No escribir en governance_module_events ni
// governance_module_links". Los escalados cross-module se realizan como HANDOFFS
// READ-ONLY por navegación (query params al intake del owner correspondiente),
// nunca insertando en estas tablas. Por eso este hook solo expone una LECTURA
// (las antiguas mutaciones useCreateModuleLink/useCreateModuleEvent se eliminaron).

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
