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

export interface UpsertRepresentanteInput {
  represented_person_id: string; // PJ
  representative_person_id: string; // PF
  entity_id: string;
  effective_from: string; // ISO date
  inscripcion_rm_referencia?: string | null;
  inscripcion_rm_fecha?: string | null;
}

/**
 * Designa representante PF para PJ administradora. Si ya existe representación
 * VIGENTE para el par (PJ, entity), la cierra (effective_to=hoy) antes de
 * insertar la nueva. También sincroniza persons.representative_person_id
 * (dual-write durante Plan A' transition — ver spec §6).
 *
 * Importante: el UNIQUE ux_representaciones_vigente cubre
 * (entity_id, represented_person_id, scope, COALESCE(meeting_id, sentinel))
 * WHERE effective_to IS NULL. Por eso cerramos la VIGENTE previa ANTES
 * del INSERT para evitar colisiones.
 */
export function useUpsertRepresentanteAdminPJ() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertRepresentanteInput): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");

      // 1. Cerrar representación VIGENTE previa (si existe)
      const today = new Date().toISOString().slice(0, 10);
      const { error: closeErr } = await supabase
        .from("representaciones")
        .update({ effective_to: today })
        .eq("tenant_id", tenantId)
        .eq("represented_person_id", input.represented_person_id)
        .eq("entity_id", input.entity_id)
        .eq("scope", "ADMIN_PJ_REPRESENTANTE")
        .is("effective_to", null);
      if (closeErr) throw closeErr;

      // 2. Insertar nueva representación
      const evidence: Record<string, unknown> = {};
      if (input.inscripcion_rm_referencia) evidence.rm_ref = input.inscripcion_rm_referencia;
      if (input.inscripcion_rm_fecha) evidence.rm_fecha = input.inscripcion_rm_fecha;

      const { data, error } = await supabase
        .from("representaciones")
        .insert({
          tenant_id: tenantId,
          represented_person_id: input.represented_person_id,
          representative_person_id: input.representative_person_id,
          entity_id: input.entity_id,
          scope: "ADMIN_PJ_REPRESENTANTE",
          effective_from: input.effective_from,
          evidence,
        })
        .select("id")
        .single();
      if (error) throw error;

      // 3. Dual-write a persons.representative_person_id (legacy, deprecable
      //    en Plan A'). Mantiene el campo en sync para consumidores antiguos
      //    que aún leen el shortcut sin pasar por representaciones.
      const { error: dualErr } = await supabase
        .from("persons")
        .update({ representative_person_id: input.representative_person_id })
        .eq("id", input.represented_person_id)
        .eq("tenant_id", tenantId);
      if (dualErr) throw dualErr;

      return { id: (data as { id: string }).id };
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
