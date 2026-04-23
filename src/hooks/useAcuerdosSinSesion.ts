import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface NoSessionResolutionRow {
  id: string;
  tenant_id: string;
  body_id: string;
  title: string;
  status: string;
  proposal_text: string | null;
  voting_deadline: string | null;
  votes_for: number | null;
  votes_against: number | null;
  abstentions: number | null;
  requires_unanimity: boolean;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  body_name: string | null;
  entity_name: string | null;
}

export function useAcuerdosSinSesionList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["no_session_resolutions", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<NoSessionResolutionRow[]> => {
      const { data, error } = await supabase
        .from("no_session_resolutions")
        .select("*, governing_bodies(name, entities(common_name))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = Omit<NoSessionResolutionRow, "body_name" | "entity_name"> & {
        governing_bodies?: { name?: string | null; entities?: { common_name?: string | null } | null } | null;
      };
      return ((data ?? []) as Raw[]).map((r) => ({
        ...r,
        body_name: r.governing_bodies?.name ?? null,
        entity_name: r.governing_bodies?.entities?.common_name ?? null,
      }));
    },
  });
}

export type NoSessionResolutionDetailRow = Omit<NoSessionResolutionRow, "body_name" | "entity_name"> & {
  governing_bodies?: {
    name?: string | null;
    entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
  } | null;
};

export function useAcuerdoSinSesionById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["no_session_resolutions", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("no_session_resolutions")
        .select("*, governing_bodies(name, entities(common_name, jurisdiction))")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as NoSessionResolutionDetailRow | null;
    },
  });
}

/**
 * Calls fn_cerrar_votaciones_vencidas() to close expired VOTING_OPEN processes.
 * Invalidates the list query on success so the UI refreshes automatically.
 */
export function useCloseExpiredVotaciones() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!tenantId) return 0;
      const { data, error } = await supabase.rpc("fn_cerrar_votaciones_vencidas", {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no_session_resolutions"] });
    },
  });
}
