import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export type AiSystem = {
  id: string;
  tenant_id: string;
  name: string;
  system_type: string | null;
  risk_level: string | null;
  vendor: string | null;
  deployment_date: string | null;
  owner_id: string | null;
  status: string;
  description: string | null;
  use_case: string | null;
  created_at: string;
};

export function useAiSystemsList(riskFilter?: string) {
  return useQuery({
    queryKey: ["ai_systems", riskFilter ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("ai_systems")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .order("created_at", { ascending: false });
      if (riskFilter) q = q.eq("risk_level", riskFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AiSystem[];
    },
  });
}

export function useAiSystemById(id: string | undefined) {
  return useQuery({
    queryKey: ["ai_systems", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("ai_systems")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as AiSystem;
    },
    enabled: !!id,
  });
}

export function useCreateAiSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AiSystem>) => {
      const { data, error } = await supabase
        .from("ai_systems")
        .insert({ ...payload, tenant_id: DEMO_TENANT })
        .select()
        .single();
      if (error) throw error;
      return data as AiSystem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_systems"] }),
  });
}
