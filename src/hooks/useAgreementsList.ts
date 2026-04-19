import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

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
  return useQuery<AgreementListRow[], Error>({
    queryKey: ["agreements", "list", statusFilter ? statusFilter.join(",") : "all"],
    queryFn: async () => {
      let query = supabase
        .from("agreements")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
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
  return useQuery<AgreementListRow | null, Error>({
    enabled: !!id,
    queryKey: ["agreements", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .eq("id", id!)
        .eq("tenant_id", DEMO_TENANT)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AgreementListRow | null;
    },
  });
}
