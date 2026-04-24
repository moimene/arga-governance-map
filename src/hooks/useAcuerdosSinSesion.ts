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

export type VoteChoice = "FOR" | "AGAINST" | "ABSTAIN";

export function useCastVote(resolutionId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async (choice: VoteChoice) => {
      if (!resolutionId || !tenantId) return;
      const col =
        choice === "FOR" ? "votes_for" :
        choice === "AGAINST" ? "votes_against" : "abstentions";

      // Read current value first (PostgREST has no atomic increment in one round-trip without RPC)
      const { data: current, error: readErr } = await supabase
        .from("no_session_resolutions")
        .select(`${col}, requires_unanimity, votes_for, votes_against, abstentions`)
        .eq("id", resolutionId)
        .eq("tenant_id", tenantId)
        .eq("status", "VOTING_OPEN")
        .maybeSingle();
      if (readErr) throw readErr;
      if (!current) throw new Error("Votación no activa");

      const newVal = ((current as Record<string, number>)[col] ?? 0) + 1;
      const updates: Record<string, unknown> = { [col]: newVal };

      // If unanimity required and someone votes against/abstains → close immediately
      if (current.requires_unanimity && (choice === "AGAINST" || choice === "ABSTAIN")) {
        updates.status = "RECHAZADO";
        updates.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("no_session_resolutions")
        .update(updates)
        .eq("id", resolutionId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no_session_resolutions"] });
    },
  });
}

export function useCloseVotacionManual(resolutionId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async (resultado: "APROBADO" | "RECHAZADO") => {
      if (!resolutionId || !tenantId) return;
      const { error } = await supabase
        .from("no_session_resolutions")
        .update({ status: resultado, closed_at: new Date().toISOString() })
        .eq("id", resolutionId)
        .eq("tenant_id", tenantId)
        .eq("status", "VOTING_OPEN");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no_session_resolutions"] });
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
