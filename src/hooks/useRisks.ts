import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type RiskRow = {
  id: string;
  code: string;
  title: string;
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

export function useRisks(filters?: { moduleId?: string }) {
  return useQuery({
    queryKey: ["grc", "risks", filters],
    queryFn: async () => {
      let q = supabase
        .from("risks")
        .select(
          "id, code, title, probability, impact, inherent_score, residual_score, module_id, status, obligation_id, finding_id, obligations:obligation_id(code, title), findings:finding_id(code, title)"
        )
        .eq("tenant_id", DEMO_TENANT)
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
