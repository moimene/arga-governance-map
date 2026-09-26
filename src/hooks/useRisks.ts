import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { Banda } from "@/lib/grc/assessed-band";

export type RiskRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  probability: number | null;
  impact: number | null;
  inherent_score: number | null;
  residual_score: number | null;
  entity_id: string | null;
  module_id: string | null;
  status: string | null;
  obligation_id: string | null;
  finding_id: string | null;
  assessed_band: Banda | null;
  assessment_breakdown: Record<string, Record<string, { color?: string; nivel?: null; motivo?: string }>> | null;
  assessment_provenance: Record<string, unknown> | null;
  obligations?: { code?: string | null; title?: string | null } | null;
  findings?: { code?: string | null; title?: string | null } | null;
  /**
   * Sistema de IA (`ai_systems.id`) que este riesgo describe, si se ha
   * podido enlazar con certeza (MOI-164). `null` en la inmensa mayoría de
   * los riesgos, que no son de IA.
   */
  ai_system_id?: string | null;
};

export type RiskWriteInput = {
  code: string;
  title: string;
  description?: string | null;
  probability?: number | null;
  impact?: number | null;
  module_id?: string | null;
  status?: string | null;
  obligation_id?: string | null;
  finding_id?: string | null;
  entity_id?: string | null;
  owner_id?: string | null;
  assessed_band?: Banda | null;
  assessment_breakdown?: Record<string, unknown> | null;
  assessment_provenance?: Record<string, unknown> | null;
};

export function useRisks(filters?: { moduleId?: string; entityId?: string | null }) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "risks", tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("risks")
        .select(
          "id, code, title, description, probability, impact, inherent_score, residual_score, entity_id, module_id, status, obligation_id, finding_id, assessed_band, assessment_breakdown, assessment_provenance, obligations:obligation_id(code, title), findings:finding_id(code, title)"
        )
        .eq("tenant_id", tenantId!)
        .order("code");

      if (filters?.moduleId) {
        q = q.eq("module_id", filters.moduleId);
      }
      if (filters?.entityId) {
        q = q.eq("entity_id", filters.entityId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RiskRow[];
    },
  });
}

export function useRiskById(id?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "risk", tenantId, id],
    enabled: !!tenantId && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select(
          "id, code, title, description, probability, impact, inherent_score, residual_score, entity_id, module_id, status, obligation_id, finding_id, assessed_band, assessment_breakdown, assessment_provenance, obligations:obligation_id(code, title), findings:finding_id(code, title)"
        )
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as RiskRow | null;
    },
  });
}

/**
 * Riesgos de GRC enlazados a un sistema de IA (`risks.ai_system_id`, MOI-164).
 * Solo lectura: la ficha del sistema en AIMS pinta el riesgo, nunca lo edita
 * ni lo crea — GRC sigue siendo el owner del dato.
 */
export function useRisksByAiSystem(aiSystemId?: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "risks", "by-ai-system", tenantId, aiSystemId],
    enabled: !!tenantId && !!aiSystemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select(
          "id, code, title, description, inherent_score, residual_score, status, assessed_band, ai_system_id"
        )
        .eq("tenant_id", tenantId!)
        .eq("ai_system_id", aiSystemId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as RiskRow[];
    },
  });
}

export function useCreateRisk() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RiskWriteInput) => {
      const { data, error } = await supabase
        .from("risks")
        .insert({ ...input, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data as RiskRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grc", "risks"] });
      qc.invalidateQueries({ queryKey: ["grc", "kpis"] });
    },
  });
}

export function useUpdateRisk(id?: string) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RiskWriteInput) => {
      const { data, error } = await supabase
        .from("risks")
        .update(input)
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .select()
        .single();
      if (error) throw error;
      return data as RiskRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grc", "risks"] });
      qc.invalidateQueries({ queryKey: ["grc", "risk", tenantId, id] });
      qc.invalidateQueries({ queryKey: ["grc", "kpis"] });
    },
  });
}
