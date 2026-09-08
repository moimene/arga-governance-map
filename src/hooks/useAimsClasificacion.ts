import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  CUESTIONARIO_VERSION,
  type MarcoNormativo,
  type Respuestas,
  type ResultadoCuestionario,
} from "@/lib/aims/cuestionario-calificacion";

/**
 * Cuestionario guiado de calificación regulatoria — acceso a
 * `aims_classification_questionnaires` (migración `20260908120000`).
 *
 * QUÉ ACREDITA Y QUÉ NO. `content_hash` es SHA-512 calculado EN SERVIDOR por la
 * RPC sobre la serialización canónica de la fila: acredita integridad del
 * contenido y quién lo completó. **No acredita fecha cierta**: `completed_at`
 * es la hora del servidor, no un sello de tiempo cualificado.
 *
 * CAMINOS. El cliente sólo puede (1) crear un DRAFT, (2) editar un DRAFT y
 * (3) pedir a la RPC que lo complete. Completar a mano, tocar `content_hash`
 * o una fila COMPLETED, o borrar, lo rechaza el servidor (trigger + grants).
 * El alta de un sistema nuevo va entera por `fn_aims_registrar_sistema`, que
 * inserta sistema y cuestionario en la misma transacción con el tenant de la
 * sesión: el cliente no manda `tenant_id`.
 */

export type EstadoCuestionario = "DRAFT" | "COMPLETED" | "SUPERSEDED";

export interface CuestionarioCalificacion {
  id: string;
  tenant_id: string;
  system_id: string;
  version: number;
  status: EstadoCuestionario;
  questionnaire_version: string;
  phase1_responses: Respuestas;
  phase2_responses: Respuestas;
  phase2_art63_justification: string | null;
  computed_role: string | null;
  computed_risk_level: string | null;
  gpai_dependency: boolean;
  applicable_frameworks: MarcoNormativo[];
  catalog_profile: string | null;
  completed_by: string | null;
  completed_at: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

/** Lo que la RPC espera en `p_cuestionario`: la clasificación derivada, sin decidir nada aquí. */
export interface PayloadCuestionario {
  questionnaire_version: string;
  phase1_responses: Respuestas;
  phase2_responses: Respuestas;
  phase2_art63_justification: string | null;
  computed_role: string | null;
  computed_risk_level: string | null;
  gpai_dependency: boolean;
  applicable_frameworks: MarcoNormativo[];
  catalog_profile: string | null;
}

const FASE1 = ["Q1_1", "Q1_2", "Q1_3", "Q1_4"] as const;

function parte(respuestas: Respuestas, ids: readonly string[]): Respuestas {
  const out: Respuestas = {};
  for (const [k, v] of Object.entries(respuestas)) {
    if (ids.includes(k) && typeof v === "boolean") (out as Record<string, boolean>)[k] = v;
  }
  return out;
}

/**
 * Traduce lo que el cuestionario derivó a las columnas de la fila. El criterio
 * ya está aplicado en `resultado` (módulo hoja); aquí sólo se reparte.
 */
export function aPayloadCuestionario(c: {
  respuestas: Respuestas;
  justificacionArt63: string;
  resultado: ResultadoCuestionario;
}): PayloadCuestionario {
  const fase2 = Object.keys(c.respuestas).filter((k) => !(FASE1 as readonly string[]).includes(k));
  return {
    questionnaire_version: CUESTIONARIO_VERSION,
    phase1_responses: parte(c.respuestas, FASE1),
    phase2_responses: parte(c.respuestas, fase2),
    phase2_art63_justification: c.justificacionArt63.trim() || null,
    computed_role: c.resultado.rol,
    computed_risk_level: c.resultado.nivel,
    gpai_dependency: c.resultado.gpai,
    applicable_frameworks: c.resultado.marcos,
    catalog_profile: c.resultado.perfil,
  };
}

export function useCuestionariosDeSistema(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_classification_questionnaires", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_classification_questionnaires")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CuestionarioCalificacion[];
    } : skipToken,
  });
}

/** El COMPLETED del sistema, o `null`. Derivado del historial: una consulta, no dos. */
export function useCuestionarioVigente(systemId: string | undefined) {
  const q = useCuestionariosDeSistema(systemId);
  return { ...q, data: q.data?.find((c) => c.status === "COMPLETED") ?? null };
}

/** El DRAFT abierto del sistema, o `null`. Sólo puede haber uno (índice parcial). */
export function useBorradorCuestionario(systemId: string | undefined) {
  const q = useCuestionariosDeSistema(systemId);
  return { ...q, data: q.data?.find((c) => c.status === "DRAFT") ?? null };
}

export interface CuestionarioVigenteResumen {
  system_id: string;
  computed_role: string | null;
  computed_risk_level: string | null;
  catalog_profile: string | null;
  completed_at: string | null;
}

/** Todos los COMPLETED del tenant: para contar en el Dashboard quién está clasificado. */
export function useCuestionariosVigentesDelTenant() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_classification_questionnaires", tenantId, "vigentes"],
    queryFn: tenantId ? async () => {
      const { data, error } = await supabase
        .from("aims_classification_questionnaires")
        .select("system_id, computed_role, computed_risk_level, catalog_profile, completed_at")
        .eq("tenant_id", tenantId!)
        .eq("status", "COMPLETED");
      if (error) throw error;
      return (data ?? []) as CuestionarioVigenteResumen[];
    } : skipToken,
  });
}

/** Crea el DRAFT de una reclasificación. Nace vacío; la versión la pone el trigger. */
export function useIniciarCuestionario() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (systemId: string) => {
      const { data, error } = await supabase
        .from("aims_classification_questionnaires")
        .insert({
          tenant_id: tenantId!,
          system_id: systemId,
          questionnaire_version: CUESTIONARIO_VERSION,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CuestionarioCalificacion;
    },
    onSuccess: (_, systemId) =>
      qc.invalidateQueries({ queryKey: ["aims_classification_questionnaires", tenantId, systemId] }),
  });
}

/**
 * Autosave del DRAFT. La escritura va acotada por tenant y por id, y se
 * comprueba que vuelve fila: la RLS filtra un UPDATE ajeno a cero filas SIN
 * error, y un borrador que «se guardó» sin guardarse perdería el trabajo.
 */
export function useGuardarBorradorCuestionario() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, systemId, payload }: { id: string; systemId: string; payload: PayloadCuestionario }) => {
      const { data, error } = await supabase
        .from("aims_classification_questionnaires")
        .update(payload)
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .eq("system_id", systemId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("No se pudo guardar el borrador: no pertenece a este entorno o ya no está en borrador.");
      }
      return data as CuestionarioCalificacion;
    },
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: ["aims_classification_questionnaires", tenantId, v.systemId] }),
  });
}

/**
 * Completa el DRAFT: la RPC valida (art. 6.3, práctica prohibida), supersede la
 * anterior, sella con SHA-512 de servidor y sincroniza `ai_systems`.
 */
export function useCompletarCuestionario() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; systemId: string }) => {
      const { data, error } = await supabase.rpc("fn_aims_completar_cuestionario", { p_id: id });
      if (error) throw error;
      return (data ?? [])[0] as { id: string; version: number; content_hash: string; completed_at: string };
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["aims_classification_questionnaires", tenantId, v.systemId] });
      qc.invalidateQueries({ queryKey: ["aims_classification_questionnaires", tenantId, "vigentes"] });
      qc.invalidateQueries({ queryKey: ["ai_systems"] });
    },
  });
}

export interface SistemaARegistrar {
  name: string;
  system_type?: string | null;
  vendor?: string | null;
  deployment_date?: string | null;
  status?: string | null;
  use_case?: string | null;
  description?: string | null;
  owner_id?: string | null;
  aims_reference_code?: string | null;
}

/**
 * Alta de un sistema CON su clasificación, en una transacción de servidor. El
 * tenant lo pone la RPC desde la sesión; un INSERT directo en `ai_systems`
 * como usuario autenticado lo rechaza el trigger.
 */
export function useRegistrarSistemaClasificado() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sistema, cuestionario }: { sistema: SistemaARegistrar; cuestionario: PayloadCuestionario }) => {
      const { data, error } = await supabase.rpc("fn_aims_registrar_sistema", {
        p_sistema: sistema,
        p_cuestionario: cuestionario,
      });
      if (error) throw error;
      const fila = (data ?? [])[0] as { system_id: string; cuestionario_id: string; content_hash: string } | undefined;
      if (!fila) throw new Error("El alta no devolvió el sistema registrado.");
      return fila;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_systems"] });
      qc.invalidateQueries({ queryKey: ["aims_classification_questionnaires", tenantId, "vigentes"] });
    },
  });
}
