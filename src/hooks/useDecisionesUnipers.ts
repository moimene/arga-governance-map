import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  return useQuery({
    queryKey: ["unipersonal_decisions", "list"],
    queryFn: async (): Promise<UnipersonalDecisionRow[]> => {
      const { data, error } = await supabase
        .from("unipersonal_decisions")
        .select(
          "*, entities(common_name, jurisdiction), persons:decided_by_id(full_name)",
        )
        .order("decision_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        entity_name: d.entities?.common_name ?? null,
        jurisdiction: d.entities?.jurisdiction ?? null,
        decider_name: d.persons?.full_name ?? null,
      }));
    },
  });
}

export function useDecisionUnipersById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["unipersonal_decisions", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unipersonal_decisions")
        .select("*, entities(common_name, jurisdiction, legal_form), persons:decided_by_id(full_name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
