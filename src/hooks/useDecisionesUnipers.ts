import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface UnipersonalDecisionRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  decision_type: string;
  title: string;
  content: string | null;
  decision_date: string | null;
  decided_by_id: string | null;
  status: string;
  requires_registry: boolean;
  created_at: string;
  entity_name: string | null;
  jurisdiction: string | null;
  decider_name: string | null;
}

export function useDecisionesUnipersList() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["unipersonal_decisions", tenantId, "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<UnipersonalDecisionRow[]> => {
      const { data, error } = await supabase
        .from("unipersonal_decisions")
        .select(
          "*, entities(common_name, jurisdiction), persons:decided_by_id(full_name)",
        )
        .eq("tenant_id", tenantId!)
        .order("decision_date", { ascending: false });
      if (error) throw error;
      type Raw = Omit<UnipersonalDecisionRow, "entity_name" | "jurisdiction" | "decider_name"> & {
        entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
        persons?: { full_name?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((d) => ({
        ...d,
        entity_name: d.entities?.common_name ?? null,
        jurisdiction: d.entities?.jurisdiction ?? null,
        decider_name: d.persons?.full_name ?? null,
      }));
    },
  });
}

export type UnipersonalDecisionDetailRow = Omit<
  UnipersonalDecisionRow,
  "entity_name" | "jurisdiction" | "decider_name"
> & {
  entities?: {
    common_name?: string | null;
    jurisdiction?: string | null;
    legal_form?: string | null;
  } | null;
  persons?: { full_name?: string | null } | null;
};

export function useDecisionUnipersById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["unipersonal_decisions", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unipersonal_decisions")
        .select("*, entities(common_name, jurisdiction, legal_form), persons:decided_by_id(full_name)")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as UnipersonalDecisionDetailRow | null;
    },
  });
}
