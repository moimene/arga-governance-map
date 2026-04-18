import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActaRow {
  id: string;
  tenant_id: string;
  meeting_id: string;
  content: string | null;
  signed_at: string | null;
  signed_by_secretary_id: string | null;
  signed_by_president_id: string | null;
  registered_at: string | null;
  is_locked: boolean;
  created_at: string;
  meeting_type: string | null;
  body_name: string | null;
  entity_name: string | null;
  resolutions_count: number;
}

export interface CertificationRow {
  id: string;
  tenant_id: string;
  minute_id: string;
  content: string | null;
  agreements_certified: string[] | null;
  certifier_id: string | null;
  requires_qualified_signature: boolean;
  signature_status: string;
  jurisdictional_requirements: any;
  created_at: string;
  agreement_id: string | null;
}

export function useActasList() {
  return useQuery({
    queryKey: ["actas", "list"],
    queryFn: async (): Promise<ActaRow[]> => {
      const { data, error } = await supabase
        .from("minutes")
        .select(
          "*, meetings(meeting_type, governing_bodies(name, entities(common_name))), meeting_resolutions:meetings(meeting_resolutions(id))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        meeting_type: m.meetings?.meeting_type ?? null,
        body_name: m.meetings?.governing_bodies?.name ?? null,
        entity_name: m.meetings?.governing_bodies?.entities?.common_name ?? null,
        resolutions_count: 0,
      }));
    },
  });
}

export function useActaById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["actas", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minutes")
        .select(
          "*, meetings(meeting_type, scheduled_start, governing_bodies(name, entities(common_name, jurisdiction)))",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCertificationsByMinute(minuteId: string | undefined) {
  return useQuery({
    enabled: !!minuteId,
    queryKey: ["certifications", "byMinute", minuteId],
    queryFn: async (): Promise<CertificationRow[]> => {
      const { data, error } = await supabase
        .from("certifications")
        .select("*")
        .eq("minute_id", minuteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CertificationRow[];
    },
  });
}
