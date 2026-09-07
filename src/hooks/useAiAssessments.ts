import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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
  checked_by_id: string | null;
  created_at: string;
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
        .select("*, ai_systems!inner(id, name, risk_level, system_type, tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AiRiskAssessment & {
        ai_systems: { id: string; name: string; risk_level: string; system_type: string; tenant_id: string };
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
        .select("*, ai_systems!inner(name, risk_level, tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (AiRiskAssessment & {
        ai_systems: { name: string; risk_level: string; tenant_id: string } | null;
      })[];
    } : skipToken,
  });
}

export function useComplianceChecksBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_compliance_checks", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .select("*, ai_systems!inner(tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiComplianceCheck[];
    } : skipToken,
  });
}

export function useAllComplianceChecks() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_compliance_checks", tenantId, "all"],
    queryFn: tenantId ? async () => {
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .select("*, ai_systems!inner(tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (AiComplianceCheck & { ai_systems: { tenant_id: string } | null })[];
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
      payload: Partial<AiRiskAssessment>;
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

      // 2. La escritura va acotada por el sistema ya comprobado, no sólo por
      //    el `id` de la fila.
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .update(payload)
        .eq("id", id)
        .eq("system_id", systemId)
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

export function useCreateComplianceChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AiComplianceCheck>[]) => {
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .insert(payload)
        .select();
      if (error) throw error;
      return data as AiComplianceCheck[];
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["ai_compliance_checks"] });
      const systemId = variables[0]?.system_id;
      if (systemId) {
        qc.invalidateQueries({ queryKey: ["ai_compliance_checks", systemId] });
      }
    },
  });
}
