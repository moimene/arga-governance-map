import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface RepresentanteAdminPJ {
  id: string;
  represented_person_id: string;
  representative_person_id: string;
  entity_id: string;
  effective_from: string;
  effective_to: string | null;
  evidence: Record<string, unknown>;
}

export interface RepresentanteAdminPJResumen {
  id: string;
  full_name: string;
  tax_id: string | null;
}

/**
 * Lookup representante PF de una PJ administradora para una sociedad concreta.
 * Returns la fila VIGENTE en representaciones con scope ADMIN_PJ_REPRESENTANTE
 * O null si no existe.
 */
export function useRepresentanteAdminPJ(
  representedPersonId: string | undefined,
  entityId: string | undefined,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!representedPersonId && !!entityId,
    queryKey: ["representaciones", tenantId, "admin_pj", representedPersonId, entityId],
    queryFn: async (): Promise<RepresentanteAdminPJ | null> => {
      const { data, error } = await supabase
        .from("representaciones")
        .select(
          "id, represented_person_id, representative_person_id, entity_id, effective_from, effective_to, evidence",
        )
        .eq("tenant_id", tenantId!)
        .eq("represented_person_id", representedPersonId!)
        .eq("entity_id", entityId!)
        .eq("scope", "ADMIN_PJ_REPRESENTANTE")
        .is("effective_to", null)
        .maybeSingle();
      if (error) throw error;
      return (data as RepresentanteAdminPJ) ?? null;
    },
  });
}

/**
 * Lookup TODAS las representaciones VIGENTE ADMIN_PJ_REPRESENTANTE de una PJ
 * (across all entities). Devuelve Map entity_id → representante PF.
 *
 * Usado por PersonaDetalle para verificar per-sociedad si la PJ tiene
 * representante asignado, en lugar de basarse en persons.representative_person_id
 * que es un atajo legacy compartido entre sociedades (P2 Codex iteration-1).
 */
export function useRepresentantesAdminPJByPerson(representedPersonId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!representedPersonId,
    queryKey: ["representaciones", tenantId, "admin_pj_by_person", representedPersonId],
    queryFn: async (): Promise<Map<string, RepresentanteAdminPJResumen>> => {
      const { data, error } = await supabase
        .from("representaciones")
        .select("entity_id, representative_person_id, representative:representative_person_id(id, full_name, tax_id)")
        .eq("tenant_id", tenantId!)
        .eq("represented_person_id", representedPersonId!)
        .eq("scope", "ADMIN_PJ_REPRESENTANTE")
        .is("effective_to", null);
      if (error) throw error;
      type RepRaw = {
        entity_id: string;
        representative_person_id: string;
        representative?: {
          id?: string | null;
          full_name?: string | null;
          tax_id?: string | null;
        } | null;
      };
      const map = new Map<string, RepresentanteAdminPJResumen>();
      for (const row of (data ?? []) as unknown as RepRaw[]) {
        map.set(row.entity_id, {
          id: row.representative?.id ?? row.representative_person_id,
          full_name: row.representative?.full_name ?? "Representante sin nombre",
          tax_id: row.representative?.tax_id ?? null,
        });
      }
      return map;
    },
  });
}

export interface UpsertRepresentanteInput {
  represented_person_id: string; // PJ
  representative_person_id: string; // PF
  entity_id: string;
  effective_from: string; // ISO date
  inscripcion_rm_referencia?: string | null;
  inscripcion_rm_fecha?: string | null;
}

/**
 * Designa representante PF para PJ administradora.
 *
 * Implementación Sprint 2: delega en `fn_upsert_representante_admin_pj`
 * para que cierre la representación previa y abra la nueva en una sola
 * transacción con tenant/capability/authority checks.
 *
 * Sprint 2: `persons.representative_person_id` queda deprecado como source
 * de lectura/escritura. La fuente canónica es `representaciones`.
 *
 * Importante: el UNIQUE ux_representaciones_vigente cubre tenant_id +
 * (entity_id, represented_person_id, scope, COALESCE(meeting_id, sentinel))
 * WHERE effective_to IS NULL. La RPC serializa por advisory lock para evitar
 * colisiones concurrentes y evitar cross-tenant conflict targets.
 */
export function useUpsertRepresentanteAdminPJ() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertRepresentanteInput): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");

      const { data, error } = await supabase.rpc("fn_upsert_representante_admin_pj", {
        p_tenant_id: tenantId,
        p_represented_person_id: input.represented_person_id,
        p_representative_person_id: input.representative_person_id,
        p_entity_id: input.entity_id,
        p_effective_from: input.effective_from,
        p_inscripcion_rm_referencia: input.inscripcion_rm_referencia ?? null,
        p_inscripcion_rm_fecha: input.inscripcion_rm_fecha ?? null,
        p_idempotency_key: [
          "upsert-representante-admin-pj",
          tenantId,
          input.entity_id,
          input.represented_person_id,
          input.representative_person_id,
          input.effective_from,
          input.inscripcion_rm_referencia?.trim() ?? "",
          input.inscripcion_rm_fecha ?? "",
        ].join(":"),
      });
      if (error) throw error;
      return { id: String(data) };
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: ["representaciones", tenantId] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
      qc.invalidateQueries({
        queryKey: ["personas_canonical", tenantId, "byId", input.represented_person_id],
      });
    },
  });
}
