import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { checksVigentes } from "@/lib/aims/checks-vigentes";
import { checksDeLaEvaluacion, type EvaluationCheck } from "@/lib/aims/evaluacion-payload";

export type AiRiskAssessment = {
  id: string;
  system_id: string | null;
  framework: string | null;
  score: number | null;
  assessment_date: string | null;
  assessor_id: string | null;
  /**
   * Las filas anteriores al 2026-09-07 sólo traen `code/title/status/planCode`:
   * los otros cuatro campos se recogían en pantalla y se descartaban al
   * persistir. Por eso son opcionales — no se puede leer como si el histórico
   * los tuviera.
   */
  findings: {
    code: string;
    status: string;
    title?: string;
    planCode?: string;
    difficulty?: string | null;
    justification?: string | null;
    kind?: "MG" | "MA";
    requirementCode?: string;
    subpartId?: string;
  }[];
  status: string;
  notes: string | null;
  created_at: string;
  /** Plan de Adaptación como acciones. `null` en las filas anteriores. */
  action_plan?: unknown;
  /** SHA-512 calculado EN SERVIDOR al congelar. */
  content_hash?: string | null;
  frozen_at?: string | null;
  frozen_by_id?: string | null;
  reviewed_at?: string | null;
  reviewed_by_id?: string | null;
  /** Cuestionario contra el que se midió (M01). Todavía no lo escribe ninguna pantalla. */
  questionnaire_id?: string | null;
};

export type AiComplianceCheck = {
  id: string;
  system_id: string | null;
  requirement_code: string;
  requirement_title: string | null;
  description: string | null;
  status: string;
  evidence_url: string | null;
  checked_at: string | null;
  /** Persona que la registró: la pone el servidor desde el perfil de la sesión (E-01). */
  checked_by_id: string | null;
  created_at: string;
  /** Autodiagnóstico del que sale (M01). `null` en las legacy: no acreditan. */
  assessment_id: string | null;
  /** La evaluación embebida, para que `checksVigentes` no deje a un borrador tapar lo revisado. */
  evaluacion?: { status: string | null; reviewed_at: string | null } | null;
};

// El guard del tenant va en la queryFn (`skipToken`), no en `enabled`: TanStack
// v5 EJECUTA la queryFn de una query deshabilitada cuando alguien llama a
// `refetch()` a mano. Estas tablas NO tienen `tenant_id` propia — el scoping va
// por el join `ai_systems!inner(tenant_id)`.
export function useAssessmentsBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_risk_assessments", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .select("*, ai_systems!inner(tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiRiskAssessment[];
    } : skipToken,
  });
}

export function useAssessmentById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_risk_assessments", tenantId, id],
    queryFn: tenantId && id ? async () => {
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .select("*, ai_systems!inner(id, name, risk_level, system_type, tenant_id, regulatory_role, regulatory_profile)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AiRiskAssessment & {
        ai_systems: {
          id: string;
          name: string;
          risk_level: string;
          system_type: string;
          tenant_id: string;
          regulatory_role: string | null;
          regulatory_profile: Record<string, unknown> | null;
        };
      };
    } : skipToken,
  });
}

export function useAllAssessments() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_risk_assessments", tenantId, "all"],
    queryFn: tenantId ? async () => {
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .select("*, ai_systems!inner(name, risk_level, tenant_id, regulatory_role, regulatory_profile)")
        .eq("ai_systems.tenant_id", tenantId!)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (AiRiskAssessment & {
        ai_systems: { name: string; risk_level: string; tenant_id: string; regulatory_role: string | null; regulatory_profile: Record<string, unknown> | null } | null;
      })[];
    } : skipToken,
  });
}

export function useComplianceChecksBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_compliance_checks", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      // La evaluación embebida: sin ella `checksVigentes` no distingue un borrador.
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .select("*, ai_systems!inner(tenant_id), evaluacion:ai_risk_assessments!assessment_id(status, reviewed_at)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // De cada requisito manda la comprobación MÁS RECIENTE: cada
      // autodiagnóstico inserta una fila por requisito y reevaluar dejaba
      // tantas como evaluaciones. El histórico se conserva en la tabla.
      return checksVigentes((data ?? []) as AiComplianceCheck[]);
    } : skipToken,
  });
}

export function useAllComplianceChecks() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_compliance_checks", tenantId, "all"],
    queryFn: tenantId ? async () => {
      // La evaluación embebida: sin ella `checksVigentes` no distingue un borrador.
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .select("*, ai_systems!inner(tenant_id), evaluacion:ai_risk_assessments!assessment_id(status, reviewed_at)")
        .eq("ai_systems.tenant_id", tenantId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return checksVigentes(
        (data ?? []) as (AiComplianceCheck & { ai_systems: { tenant_id: string } | null })[],
      );
    } : skipToken,
  });
}

// `useUpdateAssessment` se retiró el 2026-09-05: no tenía ni un importador en
// `src/` y mutaba por `id` SIN ninguna condición de tenant. Era una escritura
// cross-tenant esperando a que alguien la llamara.
//
// `useCreateAssessment` se retira hoy (2026-09-07) por lo mismo: su único
// consumidor era el wizard, que ahora pasa por `useSaveAssessment`, y lo que
// quedaba era un `.insert()` plano sin la comprobación de pertenencia. Ambas
// operaciones viven ahora en `useSaveAssessment`, que prueba primero que el
// sistema es del tenant.

/**
 * Borrador vivo de un autodiagnóstico para un sistema y marco.
 *
 * Existe porque el wizard tenía las 84 medidas en `useState` y nada más: entre
 * 30 y 60 minutos de trabajo que se perdían al cerrar la pestaña. El estado
 * `BORRADOR` ya existía en la columna y en el filtro de la lista, pero ningún
 * camino lo producía.
 */
export function useDraftAssessment(systemId: string | undefined, framework: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_risk_assessments", tenantId, "draft", systemId, framework],
    queryFn: tenantId && systemId && framework ? async () => {
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .select("*, ai_systems!inner(tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("system_id", systemId)
        .eq("framework", framework)
        .eq("status", "BORRADOR")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as AiRiskAssessment | null;
    } : skipToken,
    // El borrador es dato del propio usuario: no se refresca por debajo
    // mientras escribe, o el autoguardado pelearía con la recarga.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Guarda el autodiagnóstico: inserta si no hay fila, actualiza si la hay.
 *
 * `useUpdateAssessment` se retiró en su día porque mutaba por `id` sin ninguna
 * condición de tenant. Aquí el UPDATE está cubierto por la RLS de la tabla
 * (join contra `ai_systems.tenant_id`), pero **la RLS filtra a cero filas SIN
 * error**: sin comprobar que vuelve fila, un guardado cross-tenant —o sobre un
 * borrador que ya no existe— se daría por bueno y el trabajo se perdería en
 * silencio, que es justo lo que este hook viene a evitar.
 */
export function useSaveAssessment() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      systemId,
      payload,
    }: {
      id?: string | null;
      systemId: string;
      payload: Partial<AiRiskAssessment> & { framework: string };
    }) => {
      // 1. La pertenencia del SISTEMA al tenant, con filtro por join. Es la
      //    única condición de tenant que esta tabla puede expresar: no tiene
      //    columna propia.
      const { data: propio, error: errPropio } = await supabase
        .from("ai_systems")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("id", systemId)
        .maybeSingle();
      if (errPropio) throw errPropio;
      if (!propio) {
        throw new Error("El sistema evaluado no pertenece a este entorno.");
      }

      if (!id) {
        const { data, error } = await supabase
          .from("ai_risk_assessments")
          .insert({ ...payload, system_id: systemId })
          .select()
          .single();
        if (error) throw error;
        return data as AiRiskAssessment;
      }

      // 2. La escritura va acotada por el sistema ya comprobado Y por el marco,
      //    no sólo por el `id` de la fila: cambiar de marco en el paso 1 con un
      //    `draftId` vivo reescribía el borrador de EU_AI_ACT como ISO_42001.
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .update(payload)
        .eq("id", id)
        .eq("system_id", systemId)
        .eq("framework", payload.framework)
        .select()
        .maybeSingle();
      if (error) throw error;
      // 3. La RLS filtra un UPDATE ajeno a CERO FILAS SIN ERROR. Sin comprobar
      //    que vuelve fila, un guardado fallido se daría por bueno y el
      //    trabajo se perdería en silencio — que es justo lo que este hook
      //    viene a evitar.
      if (!data) {
        throw new Error(
          "No se pudo guardar: la evaluación no pertenece a este entorno o ya no existe.",
        );
      }
      return data as AiRiskAssessment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_risk_assessments"] }),
  });
}

/**
 * Congela una evaluación: hash SHA-512 calculado EN SERVIDOR sobre la
 * serialización canónica de la fila, y estado de sólo lectura.
 *
 * A diferencia del hash de las evidencias —que se calcula en el navegador
 * porque el fichero nunca llega a la base de datos—, aquí el contenido YA ESTÁ
 * en la fila, así que la huella no depende de lo que diga un cliente. Lo que
 * sigue sin acreditar es FECHA CIERTA: `now()` es la hora del servidor, no un
 * sello de tiempo cualificado.
 */
export function useFreezeAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessmentId: string) => {
      // La RPC asierta el tenant por el join con `ai_systems`: la tabla no
      // tiene columna propia y una SECURITY DEFINER sin ese assert sería una
      // escritura cross-tenant con privilegios elevados.
      const { data, error } = await supabase.rpc("fn_aims_freeze_assessment", {
        p_assessment_id: assessmentId,
      });
      if (error) throw error;
      return (data ?? [])[0] as { id: string; content_hash: string; frozen_at: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_risk_assessments"] }),
  });
}

/** Aprueba una congelada. La RPC rechaza que la firme quien la congeló. */
export function useReviewAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assessmentId: string) => {
      const { data, error } = await supabase.rpc("fn_aims_review_assessment", {
        p_assessment_id: assessmentId,
      });
      if (error) throw error;
      return (data ?? [])[0] as { id: string; reviewed_by_id: string; reviewed_at: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_risk_assessments"] }),
  });
}

export function useCreateComplianceChecks() {
  const qc = useQueryClient();
  return useMutation({
    // Las comprobaciones de UNA evaluación: la hoja les pone sistema y
    // evaluación, y la autoría la pone el servidor (M01, E-01).
    mutationFn: async ({ systemId, assessmentId, checks }: { systemId: string; assessmentId: string; checks: EvaluationCheck[] }) => {
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .insert(checksDeLaEvaluacion(checks, systemId, assessmentId))
        .select();
      if (error) throw error;
      return data as AiComplianceCheck[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_compliance_checks"] }),
  });
}
