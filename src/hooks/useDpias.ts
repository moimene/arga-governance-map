// MOI-175 F5.T11/T12 — lectura y registro de EIPD (art. 35 RGPD).
//
// Objeto DISTINTO de la EIDF del art. 27 RIA (DS-37, RH-5): la EIDF cubre
// derechos más amplios (igualdad, no discriminación, tutela judicial) que la
// EIPD no evalúa. Escritura SOLO por fn_grc_registrar_eipd — este hook no
// hace INSERT/UPDATE directo sobre grc_dpias (RS-TABLA, sin grant).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type DpiaNecessityResult = "REQUERIDA" | "NO_REQUERIDA_MOTIVADA" | "PENDIENTE";
export type DpiaControllerRole = "RESPONSABLE" | "CORRESPONSABLE" | "ENCARGADO";

export interface DpiaRow {
  id: string;
  tenant_id: string;
  code: string;
  entity_id: string;
  controller_role: DpiaControllerRole;
  ai_system_id: string | null;
  processing_description: string;
  necessity_result: DpiaNecessityResult;
  necessity_rationale: string;
  dpo_person_id: string | null;
  dpo_consulted_at: string | null;
  dpo_opinion: string | null;
  prior_consultation_required: boolean;
  prior_consultation_at: string | null;
  status: string;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useDpias(aiSystemId?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc_dpias", tenantId, aiSystemId ?? "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("grc_dpias")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (aiSystemId) query = query.eq("ai_system_id", aiSystemId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DpiaRow[];
    },
  });
}

export function useRegistrarEipd() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      code: string;
      entityId: string;
      controllerRole: DpiaControllerRole;
      processingDescription: string;
      aiSystemId?: string;
      necessityResult?: DpiaNecessityResult;
      necessityRationale?: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_grc_registrar_eipd", {
        p_code: params.code,
        p_entity_id: params.entityId,
        p_controller_role: params.controllerRole,
        p_processing_description: params.processingDescription,
        p_ai_system_id: params.aiSystemId ?? null,
        p_necessity_result: params.necessityResult ?? "PENDIENTE",
        p_necessity_rationale: params.necessityRationale ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grc_dpias", tenantId] });
    },
  });
}
