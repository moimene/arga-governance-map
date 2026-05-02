import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type RiskRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  probability: number | null;
  impact: number | null;
  inherent_score: number | null;
  residual_score: number | null;
  module_id: string | null;
  status: string | null;
  obligation_id: string | null;
  finding_id: string | null;
  obligations?: { code?: string | null; title?: string | null } | null;
  findings?: { code?: string | null; title?: string | null } | null;
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
};

export function useRisks(filters?: { moduleId?: string }) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "risks", tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("risks")
        .select(
          "id, code, title, description, probability, impact, inherent_score, residual_score, module_id, status, obligation_id, finding_id, obligations:obligation_id(code, title), findings:finding_id(code, title)"
        )
        .eq("tenant_id", tenantId!)
        .order("code");

      if (filters?.moduleId) {
        q = q.eq("module_id", filters.moduleId);
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
          "id, code, title, description, probability, impact, inherent_score, residual_score, module_id, status, obligation_id, finding_id, obligations:obligation_id(code, title), findings:finding_id(code, title)"
        )
        .eq("tenant_id", tenantId!)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as RiskRow | null;
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
