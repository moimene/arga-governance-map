import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type RepresentationScope =
  | "PJ_PERMANENTE"
  | "ADMIN_PJ_REPRESENTANTE"
  | "JUNTA_PROXY"
  | "CONSEJO_DELEGACION";

export interface RepresentacionRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  represented_person_id: string;
  representative_person_id: string;
  scope: RepresentationScope;
  meeting_id: string | null;
  porcentaje_delegado: number | null;
  effective_from: string;
  effective_to: string | null;
  evidence: Record<string, unknown>;
  created_at: string;
}

export interface RepresentacionDetailRow extends RepresentacionRow {
  represented?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
  } | null;
  representative?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
  } | null;
  meeting?: {
    id: string;
    scheduled_start: string | null;
    meeting_type: string | null;
    status: string | null;
    body_id: string | null;
    governing_bodies?: {
      name?: string | null;
      body_type?: string | null;
    } | null;
  } | null;
}

/** Representaciones vigentes (effective_to NULL) para una sociedad. */
export function useRepresentaciones(
  entityId: string | undefined,
  scope?: RepresentationScope,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["representaciones", tenantId, "vigente", entityId, scope ?? "all"],
    queryFn: async (): Promise<RepresentacionDetailRow[]> => {
      let q = supabase
        .from("representaciones")
        .select(`
          *,
          represented:represented_person_id(id, full_name, tax_id, person_type),
          representative:representative_person_id(id, full_name, tax_id, person_type),
          meeting:meeting_id(id, scheduled_start, meeting_type, status, body_id, governing_bodies(name, body_type))
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .is("effective_to", null);
      if (scope) q = q.eq("scope", scope);
      const { data, error } = await q.order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RepresentacionDetailRow[];
    },
  });
}

/** Histórico de representaciones donde una persona actúa como representada o representante. */
export function useRepresentacionesHistoriaByPerson(personId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!personId && !!tenantId,
    queryKey: ["representaciones", tenantId, "historia_persona", personId],
    queryFn: async (): Promise<RepresentacionDetailRow[]> => {
      const { data, error } = await supabase
        .from("representaciones")
        .select(`
          *,
          represented:represented_person_id(id, full_name, tax_id, person_type),
          representative:representative_person_id(id, full_name, tax_id, person_type),
          meeting:meeting_id(id, scheduled_start, meeting_type, status, body_id, governing_bodies(name, body_type))
        `)
        .eq("tenant_id", tenantId!)
        .or(`represented_person_id.eq.${personId},representative_person_id.eq.${personId}`)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RepresentacionDetailRow[];
    },
  });
}

export interface UpsertRepresentacionPuntualInput {
  entity_id: string;
  meeting_id: string;
  represented_person_id: string;
  representative_person_id: string;
  scope: Extract<RepresentationScope, "JUNTA_PROXY" | "CONSEJO_DELEGACION">;
  porcentaje_delegado?: number | null;
  effective_from: string;
  documento_ref?: string | null;
  notas?: string | null;
}

export function useUpsertRepresentacionPuntual() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertRepresentacionPuntualInput): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");
      const { data, error } = await supabase.rpc("fn_upsert_representacion_puntual", {
        p_tenant_id: tenantId,
        p_entity_id: input.entity_id,
        p_meeting_id: input.meeting_id,
        p_represented_person_id: input.represented_person_id,
        p_representative_person_id: input.representative_person_id,
        p_scope: input.scope,
        p_porcentaje_delegado: input.porcentaje_delegado ?? 100,
        p_effective_from: input.effective_from,
        p_evidence: {
          documento_ref: input.documento_ref?.trim() || null,
          notas: input.notas?.trim() || null,
        },
        p_idempotency_key: [
          "upsert-representacion-puntual",
          tenantId,
          input.entity_id,
          input.meeting_id,
          input.scope,
          input.represented_person_id,
          input.representative_person_id,
          input.effective_from,
        ].join(":"),
      });
      if (error) throw error;
      return { id: String(data) };
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["representaciones", tenantId] });
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings"] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId, "byId", input.represented_person_id] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId, "byId", input.representative_person_id] });
    },
  });
}

export function useCloseRepresentacionPuntual() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      effective_to: string;
      reason?: string | null;
    }): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");
      const { data, error } = await supabase.rpc("fn_close_representacion_puntual", {
        p_tenant_id: tenantId,
        p_representacion_id: input.id,
        p_effective_to: input.effective_to,
        p_reason: input.reason?.trim() || null,
        p_idempotency_key: [
          "close-representacion-puntual",
          tenantId,
          input.id,
          input.effective_to,
          input.reason?.trim() ?? "",
        ].join(":"),
      });
      if (error) throw error;
      return { id: String(data) };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["representaciones", tenantId] });
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings"] });
    },
  });
}

export const SCOPE_LABELS: Record<RepresentationScope, string> = {
  PJ_PERMANENTE: "Representante PJ permanente",
  ADMIN_PJ_REPRESENTANTE: "Representante persona jurídica",
  JUNTA_PROXY: "Delegación de voto en Junta",
  CONSEJO_DELEGACION: "Delegación en Consejo",
};
