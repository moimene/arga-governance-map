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
    queryFn: async (): Promise<{ id: string; status: string; document_url: string | null } | null> => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, status, document_url")
        .eq("tenant_id", tenantId!)
        .eq("no_session_resolution_id", resolutionId!)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string; status: string; document_url: string | null } | null) ?? null;
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
      bodyId,
      entityId,
      matterClass,
      agreementKind,
      resultado,
    }: {
      resolutionId: string;
      bodyId: string;
      entityId: string;
      matterClass: string;
      agreementKind: string;
      resultado: "APROBADO" | "RECHAZADO";
    }) => {
      const { error: closeErr } = await supabase
        .from("no_session_resolutions")
        .update({ status: resultado, closed_at: new Date().toISOString() })
        .eq("id", resolutionId)
        .eq("tenant_id", tenantId!);
      if (closeErr) throw closeErr;

      if (resultado === "APROBADO") {
        const { data: resolution, error: resolutionErr } = await supabase
          .from("no_session_resolutions")
          .select("title, proposal_text")
          .eq("id", resolutionId)
          .eq("tenant_id", tenantId!)
          .maybeSingle();
        if (resolutionErr) throw resolutionErr;
        const resolutionText =
          (resolution as { proposal_text?: string | null; title?: string | null } | null)?.proposal_text?.trim() ||
          (resolution as { title?: string | null } | null)?.title ||
          agreementKind;

        const { data, error: agErr } = await supabase
          .from("agreements")
          .insert({
            tenant_id: tenantId!,
            entity_id: entityId,
            body_id: bodyId,
            agreement_kind: agreementKind,
            matter_class: matterClass,
            adoption_mode: "NO_SESSION",
            status: "ADOPTED",
            no_session_resolution_id: resolutionId,
            proposal_text: resolutionText,
            decision_text: resolutionText,
            decision_date: new Date().toISOString().split("T")[0],
            execution_mode: {
              mode: "NO_SESSION",
              agreement_360: {
                version: "agreement-360.v1",
                origin: "NO_SESSION",
                source: "no_session_resolutions",
                no_session_resolution_id: resolutionId,
                materialized_at: new Date().toISOString(),
                materialized: true,
              },
            },
          })
          .select("id")
          .single();
        if (agErr) throw agErr;
        return (data as { id: string }).id;
      }
      return null;
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
