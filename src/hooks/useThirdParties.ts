import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type CifaAssessment = {
  q1_core: boolean;
  q2_subcontract: boolean;
  q3_alternatives: boolean;
  q4_dataloss: boolean;
  q5_concentration: boolean;
};

export type CascadeSubcontractor = {
  id: string;
  name: string;
  country: string;
  service: string;
  dataAccess: boolean;
  priorApproval: boolean;
};

export type ContractualDoraChecks = {
  audit_rights: boolean;
  supervisory_inspection: boolean;
  data_return_insolvency: boolean;
  exit_plan_tested: boolean;
  bcm_tested: boolean;
  incident_assistance: boolean;
};

export type ThirdPartyPayload = Record<string, unknown> & {
  cifa?: Partial<CifaAssessment>;
  exit_plan_signed?: boolean;
  lei_euid?: string;
  provider_type?: "Externo" | "Intragrupo" | "Subcontratista";
  country_service?: string;
  country_data_storage?: string;
  country_data_processing?: string;
  cloud_deployment_model?: "Público" | "Privado" | "Híbrido" | "Comunitario" | "On-Premise";
  is_ctpp?: boolean; // Critical Third-Party Provider bajo DORA Art. 31
  concentration_score?: number;
  substitutability_score?: number;
  subcontractors?: CascadeSubcontractor[];
  contract_checks?: Partial<ContractualDoraChecks>;
  migration_cost_estimate?: string;
  exit_time_months?: number;
  alternative_providers?: string;
};

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
  payload: ThirdPartyPayload | null;
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
      const id = input.id || `TPRM-${Math.floor(1000 + Math.random() * 9000)}`;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grc", "third-parties"] });
    },
  });
}
