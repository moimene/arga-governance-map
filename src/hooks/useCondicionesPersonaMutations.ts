import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { TipoCondicion, FuenteDesignacion } from "@/hooks/useCargos";
import {
  requiresBodyId,
  type TipoCondicionCargo,
} from "@/lib/secretaria/cargo-validation";

export interface AsignarCargoInput {
  person_id: string;
  entity_id: string;
  body_id: string | null;
  tipo_condicion: TipoCondicion;
  fecha_inicio: string; // ISO date
  representative_person_id?: string | null; // requerido si PJ admin (L2)
  fuente_designacion: FuenteDesignacion;
  inscripcion_rm_referencia?: string | null;
  inscripcion_rm_fecha?: string | null; // ISO date
}

/**
 * Designa un cargo (INSERT en condiciones_persona) con validación de
 * coherence body_id ↔ tipo_condicion en cliente (antes de tocar BD).
 *
 * El CHECK constraint `chk_condicion_body_coherente` en BD también lo
 * enforza, pero la guarda cliente da error legible inmediato sin
 * round-trip. Si el cargo es de órgano colegiado (consejo o comisión),
 * exige `body_id`; si es admin no colegiado / socio, exige `body_id`
 * NULL.
 *
 * El trigger `fn_sync_authority_evidence` propaga automáticamente una
 * fila VIGENTE en `authority_evidence` para los cargos certificantes
 * (L15-L17). No es necesario insertar manualmente.
 */
export function useAsignarCargo() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AsignarCargoInput): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no inicializado");

      // Coherence check antes de tocar BD. `TipoCondicion` y
      // `TipoCondicionCargo` son enums espejo (mismos valores, diferente
      // alias) — el cast es seguro mientras se mantengan en sync (las
      // listas se modifican en el mismo commit).
      const tipoCargo = input.tipo_condicion as TipoCondicionCargo;
      if (requiresBodyId(tipoCargo) && !input.body_id) {
        throw new Error(
          `El cargo ${input.tipo_condicion} requiere un órgano colegiado (body_id).`,
        );
      }
      if (!requiresBodyId(tipoCargo) && input.body_id) {
        throw new Error(
          `El cargo ${input.tipo_condicion} no admite órgano colegiado (body_id debe ser NULL).`,
        );
      }

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        person_id: input.person_id,
        entity_id: input.entity_id,
        body_id: input.body_id,
        tipo_condicion: input.tipo_condicion,
        estado: "VIGENTE",
        fecha_inicio: input.fecha_inicio,
        fecha_fin: null,
        fuente_designacion: input.fuente_designacion,
        inscripcion_rm_referencia: input.inscripcion_rm_referencia ?? null,
        inscripcion_rm_fecha: input.inscripcion_rm_fecha ?? null,
      };
      if (input.representative_person_id) {
        payload.representative_person_id = input.representative_person_id;
      }

      const { data, error } = await supabase
        .from("condiciones_persona")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return { id: (data as { id: string }).id };
    },
    onSuccess: (_data, input) => {
      // Invalidate relevant caches
      qc.invalidateQueries({ queryKey: ["cargos", tenantId] });
      qc.invalidateQueries({ queryKey: ["authority_evidence", tenantId] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
      if (input.body_id) {
        qc.invalidateQueries({
          queryKey: ["cargos", tenantId, "composicionOrgano", input.body_id],
        });
      }
    },
  });
}

export interface CesarCargoInput {
  condicion_id: string;
  fecha_fin: string; // ISO date
  razon?: string | null;
}

/**
 * Cesa un cargo (UPDATE estado=CESADO + fecha_fin + razón en metadata).
 *
 * L14: el cese conserva el histórico — NUNCA hace DELETE. El registro
 * permanece consultable en el histórico de la persona/órgano. La razón
 * (si se proporciona) se almacena en `metadata.cese_razon`.
 *
 * El trigger `fn_sync_authority_evidence` propaga el CESADO a
 * `authority_evidence` automáticamente, cerrando la vigencia del cargo
 * certificante asociado.
 */
export function useCesarCargo() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CesarCargoInput): Promise<void> => {
      if (!tenantId) throw new Error("Tenant no inicializado");
      const update: Record<string, unknown> = {
        estado: "CESADO",
        fecha_fin: input.fecha_fin,
      };
      if (input.razon) {
        // Persiste la razón en metadata para conservar el motivo del cese
        // junto con el timestamp. NO se hace DELETE (L14).
        update.metadata = {
          cese_razon: input.razon,
          cesado_at: new Date().toISOString(),
        };
      }
      const { error } = await supabase
        .from("condiciones_persona")
        .update(update)
        .eq("id", input.condicion_id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      // trigger fn_sync_authority_evidence propaga el CESADO a
      // authority_evidence (cierre de vigencia del cargo certificante).
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cargos", tenantId] });
      qc.invalidateQueries({ queryKey: ["authority_evidence", tenantId] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
    },
  });
}
