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

export function useAgreementForUnipersonalDecision(decisionId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!decisionId && !!tenantId,
    queryKey: ["agreements", tenantId, "byUnipersonalDecision", decisionId],
    queryFn: async (): Promise<{ id: string; status: string; document_url: string | null } | null> => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, status, document_url")
        .eq("tenant_id", tenantId!)
        .eq("unipersonal_decision_id", decisionId!)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string; status: string; document_url: string | null } | null) ?? null;
    },
  });
}

export interface CreateUnipersonalDecisionInput {
  entityId: string;
  decisionType: "SOCIO_UNICO" | "ADMINISTRADOR_UNICO";
  /** ITEM-022/051: el decisor es obligatorio — art. 15.2 LSC exige consignación bajo su firma. */
  decidedById: string;
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
          // ITEM-051: la decisión consta bajo la identidad del decisor (art.
          // 15.2 LSC). La firma QES del documento llega después vía
          // ProcessDocxButton (residual: ligar status a la firma real).
          decided_by_id: input.decidedById,
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

export interface DecisorUnipersonal {
  personId: string;
  fullName: string;
}

export interface DecisorUnipersonalResult {
  decisor: DecisorUnipersonal | null;
  /** Motivo accionable cuando no hay decisor resoluble. */
  reason: string | null;
}

/**
 * ITEM-022/051 — resuelve el decisor unipersonal real de la entidad:
 *  - SOCIO_UNICO: titular único del 100% del capital (capital_holdings
 *    vigentes, sin autocartera).
 *  - ADMINISTRADOR_UNICO: condición ADMIN_UNICO/ADMINISTRADOR_UNICO VIGENTE.
 * Si la sociedad no es realmente unipersonal para el tipo pedido, devuelve
 * decisor=null con motivo accionable (el stepper bloquea la creación).
 */
export function useDecisorUnipersonal(
  entityId: string | undefined,
  decisionType: "SOCIO_UNICO" | "ADMINISTRADOR_UNICO",
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["decisor_unipersonal", tenantId, entityId, decisionType],
    queryFn: async (): Promise<DecisorUnipersonalResult> => {
      if (decisionType === "SOCIO_UNICO") {
        const { data, error } = await supabase
          .from("capital_holdings")
          .select("holder_person_id, porcentaje_capital, is_treasury, holder:holder_person_id(full_name)")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId!)
          .is("effective_to", null);
        if (error) throw error;
        type Row = {
          holder_person_id: string;
          porcentaje_capital: number | null;
          is_treasury: boolean | null;
          holder?: { full_name?: string | null } | null;
        };
        const holders = ((data ?? []) as Row[]).filter((h) => !h.is_treasury);
        if (holders.length === 1 && Number(holders[0].porcentaje_capital ?? 0) >= 99.99) {
          return {
            decisor: {
              personId: holders[0].holder_person_id,
              fullName: holders[0].holder?.full_name ?? "Socio único",
            },
            reason: null,
          };
        }
        return {
          decisor: null,
          reason:
            holders.length === 0
              ? "La sociedad no tiene libro de socios cargado: no puede registrarse una decisión de socio único."
              : `La sociedad no es unipersonal: el libro de socios tiene ${holders.length} titulares. Las decisiones del socio único (art. 15 LSC) solo caben en SLU/SAU.`,
        };
      }

      const { data, error } = await supabase
        .from("condiciones_persona")
        .select("person_id, tipo_condicion, person:person_id(full_name)")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("estado", "VIGENTE")
        .in("tipo_condicion", ["ADMIN_UNICO", "ADMINISTRADOR_UNICO"]);
      if (error) throw error;
      type CondRow = { person_id: string; person?: { full_name?: string | null } | null };
      const admins = (data ?? []) as CondRow[];
      if (admins.length === 1) {
        return {
          decisor: {
            personId: admins[0].person_id,
            fullName: admins[0].person?.full_name ?? "Administrador único",
          },
          reason: null,
        };
      }
      return {
        decisor: null,
        reason:
          admins.length === 0
            ? "La sociedad no tiene administrador único vigente (condiciones_persona): el órgano de administración no es unipersonal."
            : "Hay más de una condición de administrador único vigente — revisar el censo de cargos.",
      };
    },
  });
}
