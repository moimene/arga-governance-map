import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  validateVoteWindow,
  type NoSessionVoteState,
  type VoteChoice,
} from "@/lib/secretaria/no-session-client-guards";
import { getRpcJsonField, isMissingSupabaseRpcError } from "@/lib/secretaria/supabase-rpc-fallback";

export type { VoteChoice } from "@/lib/secretaria/no-session-client-guards";

export interface NoSessionResolutionRow {
  id: string;
  tenant_id: string;
  body_id: string;
  title: string;
  status: string;
  proposal_text: string | null;
  matter_class: string;
  agreement_kind: string;
  voting_deadline: string | null;
  votes_for: number | null;
  votes_against: number | null;
  abstentions: number | null;
  requires_unanimity: boolean;
  total_members: number | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  body_name: string | null;
  entity_id: string | null;
  entity_name: string | null;
}

export function useAcuerdosSinSesionList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["no_session_resolutions", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<NoSessionResolutionRow[]> => {
      let bodyIds: string[] | null = null;

      if (entityId) {
        const { data: bodies, error: bodiesError } = await supabase
          .from("governing_bodies")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId);

        if (bodiesError) throw bodiesError;
        bodyIds = (bodies ?? []).map((body) => body.id);
        if (bodyIds.length === 0) return [];
      }

      let query = supabase
        .from("no_session_resolutions")
        .select("*, governing_bodies(name, entity_id, entities(common_name))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (bodyIds) {
        query = query.in("body_id", bodyIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = Omit<NoSessionResolutionRow, "body_name" | "entity_id" | "entity_name"> & {
        governing_bodies?: {
          name?: string | null;
          entity_id?: string | null;
          entities?: { common_name?: string | null } | null;
        } | null;
      };
      return ((data ?? []) as Raw[]).map((r) => ({
        ...r,
        body_name: r.governing_bodies?.name ?? null,
        entity_id: r.governing_bodies?.entity_id ?? null,
        entity_name: r.governing_bodies?.entities?.common_name ?? null,
      }));
    },
  });
}

export type NoSessionResolutionDetailRow = Omit<NoSessionResolutionRow, "body_name" | "entity_name"> & {
  governing_bodies?: {
    name?: string | null;
    body_type?: string | null;
    entity_id?: string | null;
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
        .select("*, governing_bodies(name, body_type, entity_id, entities(common_name, jurisdiction))")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as NoSessionResolutionDetailRow | null;
    },
  });
}

export function useAgreementForNoSessionResolution(resolutionId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!resolutionId && !!tenantId,
    queryKey: ["agreements", tenantId, "byNoSessionResolution", resolutionId],
    queryFn: async (): Promise<{ id: string; status: string; document_url: string | null; execution_mode: Record<string, unknown> | null } | null> => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, status, document_url, execution_mode")
        .eq("tenant_id", tenantId!)
        .eq("no_session_resolution_id", resolutionId!)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string; status: string; document_url: string | null; execution_mode: Record<string, unknown> | null } | null) ?? null;
    },
  });
}

export function useCastVote(resolutionId: string | undefined) {
  const queryClient = useQueryClient();
  const { tenantId, personId } = useTenantContext();

  return useMutation({
    mutationFn: async (choice: VoteChoice) => {
      if (!resolutionId || !tenantId) return;
      const { data: current, error: readErr } = await supabase
        .from("no_session_resolutions")
        .select("status, requires_unanimity, votes_for, votes_against, abstentions, total_members, voting_deadline")
        .eq("id", resolutionId)
        .eq("tenant_id", tenantId)
        .eq("status", "VOTING_OPEN")
        .maybeSingle();
      if (readErr) throw readErr;
      if (!current) throw new Error("Votación no activa");

      const voteWindow = validateVoteWindow(current as NoSessionVoteState);
      if (!voteWindow.ok) {
        throw new Error(voteWindow.reason ?? "No se pudo registrar el voto");
      }
      if (!personId) {
        throw new Error("No hay persona vinculada al usuario actual para registrar el voto.");
      }

      const sentido =
        choice === "FOR" ? "CONSENTIMIENTO" :
        choice === "AGAINST" ? "OBJECION" : "SILENCIO";
      const { error: rpcError } = await supabase.rpc("fn_no_session_cast_response", {
        p_tenant_id: tenantId,
        p_resolution_id: resolutionId,
        p_person_id: personId,
        p_sentido: sentido,
        p_texto_respuesta: null,
        p_firma_qes_ref: null,
        p_notificacion_certificada_ref: null,
      });
      if (!rpcError) return;
      if (isMissingSupabaseRpcError(rpcError)) {
        throw new Error("La RPC transaccional de voto sin sesión no está disponible. No se registra voto desde fallback cliente.");
      }
      throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no_session_resolutions"] });
    },
  });
}

export interface CreateNoSessionResolutionInput {
  body_id: string;
  title: string;
  proposal_text: string;
  matter_class: string;
  agreement_kind: string;
  requires_unanimity: boolean;
  total_members: number;
  voting_deadline: string;
}

export function useCreateNoSessionResolution() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoSessionResolutionInput): Promise<{ id: string }> => {
      const { data, error } = await supabase
        .from("no_session_resolutions")
        .insert({
          tenant_id: tenantId!,
          body_id: input.body_id,
          title: input.title,
          proposal_text: input.proposal_text,
          matter_class: input.matter_class,
          agreement_kind: input.agreement_kind,
          requires_unanimity: input.requires_unanimity,
          total_members: input.total_members,
          voting_deadline: input.voting_deadline,
          status: "VOTING_OPEN",
          opened_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no_session_resolutions"] });
    },
  });
}

export function useAdoptNoSessionAgreement() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      resolutionId,
      resultado,
      selectedTemplateId,
    }: {
      resolutionId: string;
      resultado: "APROBADO" | "RECHAZADO";
      selectedTemplateId?: string | null;
    }) => {
      const { data: rpcData, error: rpcError } = await supabase.rpc("fn_no_session_close_and_materialize_agreement", {
        p_tenant_id: tenantId!,
        p_resolution_id: resolutionId,
        p_resultado: resultado,
        p_selected_template_id: selectedTemplateId ?? null,
      });
      if (!rpcError) {
        const agreementId = getRpcJsonField(rpcData, "agreement_id");
        if (resultado === "APROBADO" && !agreementId) {
          throw new Error("La materialización transaccional no devolvió agreement_id.");
        }
        return agreementId;
      }
      if (isMissingSupabaseRpcError(rpcError)) {
        throw new Error("La RPC transaccional de cierre/materialización sin sesión no está disponible. No se materializa desde fallback cliente.");
      }
      throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["no_session_resolutions"] });
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
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
