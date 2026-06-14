import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { AgendaDraftAction, AgendaDraftEstado } from "@/lib/secretaria/agenda-draft";

/**
 * W9 — bandeja de borradores de punto de agenda (cross-módulo). Lectura de la
 * cola y transición de estado vía RPC (el estado solo se muta por RPC, trigger
 * guard).
 */
export interface AgendaDraftRow {
  id: string;
  entity_id: string | null;
  origen_modulo: string;
  origen_evento: string | null;
  titulo: string;
  descripcion: string | null;
  materia: string | null;
  estado: AgendaDraftEstado;
  created_at: string;
}

export function useAgendaDrafts(activeOnly = true) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["agenda_drafts", tenantId, activeOnly ? "active" : "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<AgendaDraftRow[]> => {
      let q = supabase
        .from("agenda_draft")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (activeOnly) q = q.in("estado", ["PENDIENTE", "POSPUESTO", "APROBADO"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AgendaDraftRow[];
    },
  });
}

export function useAgendaDraftTransicion() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      action: AgendaDraftAction;
      convocatoriaId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("fn_agenda_draft_transicion", {
        p_draft_id: params.draftId,
        p_action: params.action,
        p_convocatoria_id: params.convocatoriaId ?? null,
      });
      if (error) throw error;
      return data as { draft_id: string; estado: AgendaDraftEstado };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agenda_drafts", tenantId] }),
  });
}
