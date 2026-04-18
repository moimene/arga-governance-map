import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

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
      return data ?? [];
    },
  });
}
