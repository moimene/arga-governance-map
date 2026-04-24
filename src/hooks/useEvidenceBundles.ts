import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["evidence_bundles", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<EvidenceBundle[]> => {
      const { data, error } = await supabase
        .from("evidence_bundles")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EvidenceBundle[];
    },
  });
}

export function useVerifyAuditChain() {
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fn_verify_audit_chain", {
        p_tenant_id: tenantId!,
      });
      if (error) throw error;
      return data;
    },
  });
}
