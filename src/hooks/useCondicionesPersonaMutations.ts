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
 * Designa un cargo vía RPC transaccional `fn_designar_cargo` con validación
 * de coherence body_id ↔ tipo_condicion en cliente (antes de tocar BD).
 *
 * El CHECK constraint `chk_condicion_body_coherente` en BD también lo
 * enforza, pero la guarda cliente da error legible inmediato sin
 * round-trip. Si el cargo es de órgano colegiado (consejo o comisión),
 * exige `body_id`; si es admin no colegiado / socio, exige `body_id`
 * NULL.
 *
 * La RPC aplica tenant/capability/authority checks, cierra singletons
 * previos en la misma transacción (L12-C) y deja que el trigger
 * `fn_sync_authority_evidence` propague `authority_evidence` para los
 * cargos certificantes (L15-L17).
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

      const { data, error } = await supabase.rpc("fn_designar_cargo", {
        p_tenant_id: tenantId,
        p_person_id: input.person_id,
        p_entity_id: input.entity_id,
        p_body_id: input.body_id,
        p_tipo_condicion: input.tipo_condicion,
        p_fecha_inicio: input.fecha_inicio,
        p_fuente_designacion: input.fuente_designacion,
        p_inscripcion_rm_referencia: input.inscripcion_rm_referencia ?? null,
        p_inscripcion_rm_fecha: input.inscripcion_rm_fecha ?? null,
        p_representative_person_id: input.representative_person_id ?? null,
        p_cesar_singleton_previo: true,
        p_idempotency_key: [
          "designar",
          tenantId,
          input.person_id,
          input.entity_id,
          input.body_id ?? "no-body",
          input.tipo_condicion,
          input.fecha_inicio,
          input.fuente_designacion,
          input.inscripcion_rm_referencia?.trim() ?? "",
          input.inscripcion_rm_fecha ?? "",
          input.representative_person_id ?? "",
        ].join(":"),
      });
      if (error) throw error;
      return { id: String(data) };
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
 * Cesa un cargo vía RPC transaccional (estado=CESADO + fecha_fin +
 * razón en metadata).
 *
 * L14: el cese conserva el histórico — NUNCA hace DELETE. El registro
 * permanece consultable en el histórico de la persona/órgano. La razón
 * (si se proporciona) se almacena en `metadata.cese_razon` dentro de
 * `fn_cesar_cargo`, con tenant/capability/authority checks.
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

      const { error } = await supabase.rpc("fn_cesar_cargo", {
        p_tenant_id: tenantId,
        p_condicion_id: input.condicion_id,
        p_fecha_fin: input.fecha_fin,
        p_razon: input.razon ?? null,
        p_idempotency_key: [
          "cesar",
          tenantId,
          input.condicion_id,
          input.fecha_fin,
          input.razon ?? "",
        ].join(":"),
      });
      if (error) throw error;
      // La RPC no borra históricos; el trigger fn_sync_authority_evidence
      // propaga el CESADO a authority_evidence.
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cargos", tenantId] });
      qc.invalidateQueries({ queryKey: ["authority_evidence", tenantId] });
      qc.invalidateQueries({ queryKey: ["personas_canonical", tenantId] });
    },
  });
}
