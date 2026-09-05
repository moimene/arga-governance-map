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
  findings: { code: string; status: string; title?: string; planCode?: string }[];
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

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AiRiskAssessment>) => {
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as AiRiskAssessment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_risk_assessments"] }),
  });
}

// `useUpdateAssessment` se ha retirado (2026-09-05): no tenía ni un importador
// en `src/` y mutaba por `id` SIN ninguna condición de tenant, ni por columna ni
// por join. Era una escritura cross-tenant esperando a que alguien la llamara.
// Si vuelve a hacer falta, tiene que filtrar como las lecturas de este fichero:
// `ai_risk_assessments` no tiene `tenant_id`, así que el scoping va por
// `ai_systems!inner(tenant_id)`, que en un UPDATE exige comprobar antes la
// pertenencia del `system_id`.

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
