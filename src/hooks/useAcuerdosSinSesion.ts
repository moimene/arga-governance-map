import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

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
        .eq("tenant_id", DEMO_TENANT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = Omit<NoSessionResolutionRow, "body_name" | "entity_name"> & {
        governing_bodies?: { name?: string | null; entities?: { common_name?: string | null } | null } | null;
      };
      return ((data ?? []) as Raw[]).map((r) => ({
        ...r,
        body_name: r.governing_bodies?.name ?? null,
        entity_name: r.governing_bodies?.entities?.common_name ?? null,
      }));
    },
  });
}

export type NoSessionResolutionDetailRow = Omit<NoSessionResolutionRow, "body_name" | "entity_name"> & {
  governing_bodies?: {
    name?: string | null;
    entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
  } | null;
};

export function useAcuerdoSinSesionById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["no_session_resolutions", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("no_session_resolutions")
        .select("*, governing_bodies(name, entities(common_name, jurisdiction))")
        .eq("id", id!)
        .eq("tenant_id", DEMO_TENANT)
        .maybeSingle();
      if (error) throw error;
      return data as NoSessionResolutionDetailRow | null;
    },
  });
}
