import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type ThirdParty = {
  id: string;
  provider: string;
  service: string;
  criticality: string;
  cloud_exposure: string;
  regulatory_basis: string;
  due_diligence: string;
  contract_clauses: string;
  exit_plan: string;
  next_review: string | null;
  legal_hold: boolean;
  owner: string;
  payload: any;
  created_at: string;
  updated_at: string;
};

export function useThirdParties() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "third-parties", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grc_third_parties")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("provider", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ThirdParty[];
    },
  });
}

export function useThirdParty(id?: string) {
  return useQuery({
    queryKey: ["grc", "third-party", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grc_third_parties")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as ThirdParty | null;
    },
  });
}

export function useCreateThirdParty() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ThirdParty, "id" | "created_at" | "updated_at"> & { id?: string }) => {
      const id = input.id || `TPRM-ARGA-${Math.floor(100 + Math.random() * 900)}`;
      const { data, error } = await supabase
        .from("grc_third_parties")
        .insert({ ...input, id, tenant_id: tenantId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grc", "third-parties"] });
    },
  });
}

export function useUpdateThirdParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: Partial<ThirdParty> & { id: string }) => {
      const { data, error } = await supabase
        .from("grc_third_parties")
        .update(changes)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["grc", "third-parties"] });
      qc.invalidateQueries({ queryKey: ["grc", "third-party", variables.id] });
    },
  });
}
