import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type AiRiskAssessment = {
  id: string;
  system_id: string | null;
  framework: string | null;
  score: number | null;
  assessment_date: string | null;
  assessor_id: string | null;
  findings: { code: string; status: string }[];
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

// NOTA: ai_risk_assessments y ai_compliance_checks no tienen columna tenant_id
// directa; se aplica tenant scoping vía inner join con ai_systems.tenant_id.
// Si un system_id no pertenece al tenant activo, la query devuelve vacío.

export function useAssessmentsBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_risk_assessments", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .select("*, ai_systems!inner(tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AiRiskAssessment[];
    },
    enabled: !!systemId && !!tenantId,
  });
}

export function useAllAssessments() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_risk_assessments", tenantId, "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_risk_assessments")
        .select("*, ai_systems!inner(name, risk_level, tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (AiRiskAssessment & { ai_systems: { name: string; risk_level: string; tenant_id: string } | null })[];
    },
    enabled: !!tenantId,
  });
}

export function useComplianceChecksBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["ai_compliance_checks", tenantId, systemId],
    queryFn: async () => {
      if (!systemId) return [];
      const { data, error } = await supabase
        .from("ai_compliance_checks")
        .select("*, ai_systems!inner(tenant_id)")
        .eq("ai_systems.tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AiComplianceCheck[];
    },
    enabled: !!systemId && !!tenantId,
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
