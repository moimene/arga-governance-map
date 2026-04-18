import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NoSessionResolutionRow {
  id: string;
  tenant_id: string;
  body_id: string;
  title: string;
  status: string;
  proposal_text: string | null;
  voting_deadline: string | null;
  votes_for: number | null;
  votes_against: number | null;
  abstentions: number | null;
  requires_unanimity: boolean;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  body_name: string | null;
  entity_name: string | null;
}

export function useAcuerdosSinSesionList() {
  return useQuery({
    queryKey: ["no_session_resolutions", "list"],
    queryFn: async (): Promise<NoSessionResolutionRow[]> => {
      const { data, error } = await supabase
        .from("no_session_resolutions")
        .select("*, governing_bodies(name, entities(common_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        body_name: r.governing_bodies?.name ?? null,
        entity_name: r.governing_bodies?.entities?.common_name ?? null,
      }));
    },
  });
}

export function useAcuerdoSinSesionById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["no_session_resolutions", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("no_session_resolutions")
        .select("*, governing_bodies(name, entities(common_name, jurisdiction))")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
