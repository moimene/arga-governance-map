import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface CapitalMovementRow {
  id: string;
  entity_id: string;
  agreement_id: string | null;
  person_id: string;
  share_class_id: string | null;
  delta_shares: number;
  delta_voting_weight: number;
  delta_denominator_weight: number;
  movement_type: string;
  effective_date: string;
  notas: string | null;
  created_at: string;
  persons?: { full_name: string | null; tax_id: string | null } | null;
  agreements?: { agreement_kind: string | null } | null;
  share_classes?: { name: string | null } | null;
}

export function useCapitalMovements(entityId?: string) {
  const { tenantId } = useTenantContext();
  return useQuery<CapitalMovementRow[], Error>({
    queryKey: ["capital_movements", tenantId, entityId ?? "all"],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("capital_movements")
        .select(
          `*, persons(full_name, tax_id), agreements(agreement_kind), share_classes(name)`
        )
        .eq("tenant_id", tenantId!)
        .order("effective_date", { ascending: false });

      if (entityId) q = q.eq("entity_id", entityId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CapitalMovementRow[];
    },
  });
}
