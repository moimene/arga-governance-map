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

/**
 * Lookup TODAS las representaciones VIGENTE ADMIN_PJ_REPRESENTANTE de una PJ
 * (across all entities). Devuelve Map entity_id → representative_person_id.
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
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("representaciones")
        .select("entity_id, representative_person_id")
        .eq("tenant_id", tenantId!)
        .eq("represented_person_id", representedPersonId!)
        .eq("scope", "ADMIN_PJ_REPRESENTANTE")
        .is("effective_to", null);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as Array<{ entity_id: string; representative_person_id: string }>) {
        map.set(row.entity_id, row.representative_person_id);
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
 * IMPLEMENTACIÓN — NO ATOMICITY, BEST-EFFORT REVERT:
 * supabase-js no expone transacciones cliente. Esta función usa try/catch
 * con revert manual: si el INSERT falla tras cerrar la representación
 * previa, intenta re-abrirla (UPDATE effective_to=null). Casos catastróficos
 * (insert fail + revert fail) se loggean en consola.
 *
 * Atomicity real (RPC SECURITY DEFINER fn_designar_representante) está
 * diferida a Plan A' (ver spec §6).
 *
 * También sincroniza persons.representative_person_id (dual-write durante
 * transición Plan A' — deprecable cuando UI lea solo de representaciones).
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

      // 1. Snapshot la representación previa VIGENTE (si existe) para revert path
      const today = new Date().toISOString().slice(0, 10);
      const { data: previaArray, error: lookupErr } = await supabase
        .from("representaciones")
        .select("id, effective_to")
        .eq("tenant_id", tenantId)
        .eq("represented_person_id", input.represented_person_id)
        .eq("entity_id", input.entity_id)
        .eq("scope", "ADMIN_PJ_REPRESENTANTE")
        .is("effective_to", null);
      if (lookupErr) throw lookupErr;
      const previaIds: string[] = (previaArray ?? []).map((r) => r.id as string);

      // 2. Close previa (UPDATE effective_to=today)
      if (previaIds.length > 0) {
        const { error: closeErr } = await supabase
          .from("representaciones")
          .update({ effective_to: today })
          .in("id", previaIds);
        if (closeErr) throw closeErr;
      }

      // 3. Insert nueva — wrapped en try/catch para revert si falla
      const evidence: Record<string, unknown> = {};
      if (input.inscripcion_rm_referencia) evidence.rm_ref = input.inscripcion_rm_referencia;
      if (input.inscripcion_rm_fecha) evidence.rm_fecha = input.inscripcion_rm_fecha;

      try {
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

        // 4. Dual-write a persons.representative_person_id (legacy)
        await supabase
          .from("persons")
          .update({ representative_person_id: input.representative_person_id })
          .eq("id", input.represented_person_id)
          .eq("tenant_id", tenantId);

        return { id: (data as { id: string }).id };
      } catch (insertErr) {
        // Revert: re-open la representación previa cerrada en paso 2
        if (previaIds.length > 0) {
          const { error: revertErr } = await supabase
            .from("representaciones")
            .update({ effective_to: null })
            .in("id", previaIds);
          if (revertErr) {
            // Catastrophic: insert failed AND revert failed. Log both for forensics.
            console.error("CRITICAL: insert failed + revert failed", { insertErr, revertErr });
          }
        }
        throw insertErr;
      }
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
