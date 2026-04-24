import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface AgreementListRow {
  id: string;
  tenant_id: string;
  entity_id: string | null;
  body_id: string | null;
  agreement_kind: string;
  matter_class: string;
  inscribable: boolean;
  adoption_mode: string;
  decision_date: string | null;
  status: string;
  created_at: string;
}

/**
 * useAgreementsList — Fetches all agreements for the demo tenant,
 * optionally filtered by status (e.g., "CERTIFIED", "ADOPTED")
 *
 * Usage:
 *   const { data: agreements } = useAgreementsList(["CERTIFIED", "ADOPTED"]);
 */
export function useAgreementsList(statusFilter?: string[]) {
  const { tenantId } = useTenantContext();
  return useQuery<AgreementListRow[], Error>({
    queryKey: ["agreements", tenantId, "list", statusFilter ? statusFilter.join(",") : "all"],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("agreements")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AgreementListRow[];
    },
  });
}

/**
 * useAgreementById — Fetches a single agreement with its related entities
 */
export function useAgreementById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery<AgreementListRow | null, Error>({
    enabled: !!id && !!tenantId,
    queryKey: ["agreements", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AgreementListRow | null;
    },
  });
}
