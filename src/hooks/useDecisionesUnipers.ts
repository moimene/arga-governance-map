import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface UnipersonalDecisionRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  decision_type: string;
  title: string;
  content: string | null;
  decision_date: string | null;
  decided_by_id: string | null;
  status: string;
  requires_registry: boolean;
  created_at: string;
  entity_name: string | null;
  jurisdiction: string | null;
  decider_name: string | null;
}

export function useDecisionesUnipersList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["unipersonal_decisions", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<UnipersonalDecisionRow[]> => {
      let query = supabase
        .from("unipersonal_decisions")
        .select(
          "*, entities(common_name, jurisdiction), persons:decided_by_id(full_name)",
        )
        .eq("tenant_id", tenantId!)
        .order("decision_date", { ascending: false });

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = Omit<UnipersonalDecisionRow, "entity_name" | "jurisdiction" | "decider_name"> & {
        entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
        persons?: { full_name?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((d) => ({
        ...d,
        entity_name: d.entities?.common_name ?? null,
        jurisdiction: d.entities?.jurisdiction ?? null,
        decider_name: d.persons?.full_name ?? null,
      }));
    },
  });
}

export type UnipersonalDecisionDetailRow = Omit<
  UnipersonalDecisionRow,
  "entity_name" | "jurisdiction" | "decider_name"
> & {
  entities?: {
    common_name?: string | null;
    jurisdiction?: string | null;
    legal_form?: string | null;
  } | null;
  persons?: { full_name?: string | null } | null;
};

export function useDecisionUnipersById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["unipersonal_decisions", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unipersonal_decisions")
        .select("*, entities(common_name, jurisdiction, legal_form), persons:decided_by_id(full_name)")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as UnipersonalDecisionDetailRow | null;
    },
  });
}

export interface CreateUnipersonalDecisionInput {
  entityId: string;
  decisionType: "SOCIO_UNICO" | "ADMINISTRADOR_UNICO";
  agreementKind: string;
  matterClass: string;
  title: string;
  content: string;
  requiresRegistry: boolean;
}

function adoptionModeForDecision(type: CreateUnipersonalDecisionInput["decisionType"]) {
  return type === "SOCIO_UNICO" ? "UNIPERSONAL_SOCIO" : "UNIPERSONAL_ADMIN";
}

export function useCreateUnipersonalDecision() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUnipersonalDecisionInput): Promise<{ decisionId: string; agreementId: string }> => {
      const decisionDate = new Date().toISOString().split("T")[0];
      const { data: decision, error: decisionError } = await supabase
        .from("unipersonal_decisions")
        .insert({
          tenant_id: tenantId!,
          entity_id: input.entityId,
          decision_type: input.decisionType,
          title: input.title,
          content: input.content,
          decision_date: decisionDate,
          decided_by_id: null,
          status: "FIRMADA",
          requires_registry: input.requiresRegistry,
        })
        .select("id")
        .single();
      if (decisionError) throw decisionError;

      const decisionId = (decision as { id: string }).id;
      const { data: agreement, error: agreementError } = await supabase
        .from("agreements")
        .insert({
          tenant_id: tenantId!,
          entity_id: input.entityId,
          body_id: null,
          agreement_kind: input.agreementKind,
          matter_class: input.matterClass,
          adoption_mode: adoptionModeForDecision(input.decisionType),
          status: "ADOPTED",
          unipersonal_decision_id: decisionId,
          decision_date: decisionDate,
          decision_text: input.content,
          proposal_text: input.title,
        })
        .select("id")
        .single();
      if (agreementError) throw agreementError;

      return { decisionId, agreementId: (agreement as { id: string }).id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unipersonal_decisions"] });
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    },
  });
}
