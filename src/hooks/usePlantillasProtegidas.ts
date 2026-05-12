import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  transitionTemplateState,
  type TransitionResult,
} from "@/lib/secretaria/template-admin/template-admin-service";

export interface PlantillaProtegidaRow {
  id: string;
  tenant_id: string;
  tipo: string;
  materia: string | null;
  jurisdiccion: string;
  version: string;
  estado: string;
  aprobada_por: string | null;
  fecha_aprobacion: string | null;
  contenido_template: string | null;
  capa1_inmutable: string | null;
  capa2_variables: Array<{ variable: string; fuente: string; condicion: string }> | null;
  capa3_editables: Array<{ campo: string; obligatoriedad: string; descripcion: string }> | null;
  referencia_legal: string | null;
  notas_legal: string | null;
  variables: unknown[];
  protecciones: Record<string, unknown>;
  snapshot_rule_pack_required: boolean;
  adoption_mode: string | null;
  organo_tipo: string | null;
  contrato_variables_version: string | null;
  created_at: string;
  materia_acuerdo: string | null;
  approval_checklist: Array<{ check: string; passed: boolean }> | null;
  version_history: Array<{ from: string; to: string; at: string; by: string }> | null;
}

export function usePlantillasProtegidas() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["plantillas_protegidas", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantillas_protegidas")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("tipo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlantillaProtegidaRow[];
    },
  });
}

export function usePlantillaProtegida(id?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["plantillas_protegidas", tenantId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantillas_protegidas")
        .select("*")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as PlantillaProtegidaRow | null;
    },
    enabled: !!id && !!tenantId,
  });
}

/**
 * Estado al que se puede transicionar una plantilla desde el hook.
 *
 * Incluye DEPRECADA por coherencia con `EstadoPlantilla` del módulo
 * template-admin, aunque las transiciones desde/hacia DEPRECADA no son
 * habituales en el flujo del Gestor (Sprint 1).
 */
export type EstadoPlantillaInput =
  | "BORRADOR"
  | "REVISADA"
  | "APROBADA"
  | "ACTIVA"
  | "ARCHIVADA"
  | "DEPRECADA";

/**
 * Input del hook. Acepta dos formas equivalentes:
 *
 *  - Nueva (preferida): `estado` + opcionales `motivo` / `actor` / `ackWarnings`.
 *  - Legacy: `nuevo_estado` (alias de `estado`) + `aprobada_por` (alias informativo
 *    de `actor`). Se mantiene para evitar romper consumidores existentes
 *    (`Plantillas.tsx`, `GestorPlantillas.tsx`) antes de Commit 5.
 *
 * Internamente todo se delega a `transitionTemplateState`, que aplica el state
 * machine + Gate PRE (si destino es ACTIVA) + changelog con rollback.
 */
export type UpdateEstadoPlantillaInput = {
  id: string;
  /** Estado destino. Preferido sobre `nuevo_estado`. */
  estado?: EstadoPlantillaInput | string;
  /** Alias legacy de `estado` (consumidores anteriores al refactor). */
  nuevo_estado?: EstadoPlantillaInput | string;
  motivo?: string;
  actor?: string;
  /** Alias legacy informativo: si no se da `actor`, se usa para identificar quién aprueba. */
  aprobada_por?: string;
  ackWarnings?: boolean;
};

const VALID_ESTADOS: ReadonlySet<EstadoPlantillaInput> = new Set([
  "BORRADOR",
  "REVISADA",
  "APROBADA",
  "ACTIVA",
  "ARCHIVADA",
  "DEPRECADA",
]);

function asEstadoPlantilla(value: string): EstadoPlantillaInput {
  if (!VALID_ESTADOS.has(value as EstadoPlantillaInput)) {
    throw new Error(
      `Estado inválido '${value}'. Valores aceptados: ${[...VALID_ESTADOS].join(", ")}`,
    );
  }
  return value as EstadoPlantillaInput;
}

export function useUpdateEstadoPlantilla() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async (input: UpdateEstadoPlantillaInput): Promise<TransitionResult> => {
      if (!tenantId) throw new Error("tenantId requerido");
      const estadoRaw = input.estado ?? input.nuevo_estado;
      if (!estadoRaw) throw new Error("estado requerido (usar 'estado' o 'nuevo_estado')");
      const estado = asEstadoPlantilla(estadoRaw);
      const actor = input.actor ?? input.aprobada_por ?? "system";
      const result = await transitionTemplateState(
        {
          plantillaId: input.id,
          to: estado,
          motivo: input.motivo ?? "transición manual",
          actor,
          ackWarnings: input.ackWarnings,
        },
        { tenantId },
      );
      if (result.ok === false) {
        const err = new Error(`Transición rechazada: ${result.reason}`);
        (err as Error & { result?: TransitionResult }).result = result;
        throw err;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      queryClient.invalidateQueries({ queryKey: ["plantillas", "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["plantilla_changelog"] });
    },
  });
}

export function useUpdateContenidoPlantilla() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      capa1_inmutable?: string;
      capa3_editables?: Array<{
        campo: string;
        obligatoriedad: string;
        descripcion: string;
      }>;
      notas_legal?: string;
    }) => {
      const updates: Record<string, unknown> = {};

      if (params.capa1_inmutable !== undefined) {
        updates.capa1_inmutable = params.capa1_inmutable;
      }

      if (params.capa3_editables !== undefined) {
        updates.capa3_editables = params.capa3_editables;
      }

      if (params.notas_legal !== undefined) {
        updates.notas_legal = params.notas_legal;
      }

      const { error } = await supabase
        .from("plantillas_protegidas")
        .update(updates)
        .eq("id", params.id)
        .eq("tenant_id", tenantId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      queryClient.invalidateQueries({ queryKey: ["plantillas", "metrics"] });
    },
  });
}
