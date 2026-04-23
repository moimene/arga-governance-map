import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface EvidenceBundle {
  id: string;
  tenant_id: string;
  reference_code: string | null;
  document_url: string | null;
  hash_sha512: string | null;
  signed_by: string | null;
  signature_date: string | null;
  chain_of_custody: Record<string, unknown> | null;
  legal_hold: boolean;
  created_at: string;
}

export function useEvidenceBundlesList() {
  return useQuery({
    queryKey: ["evidence_bundles", "list"],
    queryFn: async (): Promise<EvidenceBundle[]> => {
      const { data, error } = await supabase
        .from("evidence_bundles")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EvidenceBundle[];
    },
  });
}

export function useVerifyAuditChain() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fn_verify_audit_chain", {
        p_tenant_id: DEMO_TENANT,
      });
      if (error) throw error;
      return data;
    },
  });
}
