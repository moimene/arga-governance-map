import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

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
  jurisdictional_requirements: Record<string, unknown> | null;
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
          "*, meetings(meeting_type, governing_bodies(name, entities(common_name)))",
        )
        .eq("tenant_id", DEMO_TENANT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      type MinuteRaw = Omit<ActaRow, "meeting_type" | "body_name" | "entity_name" | "resolutions_count"> & {
        meetings?: {
          meeting_type?: string | null;
          governing_bodies?: { name?: string | null; entities?: { common_name?: string | null } | null } | null;
        } | null;
      };
      const rows = (data ?? []) as MinuteRaw[];

      // Count resolutions per meeting in a single query
      const meetingIds = rows.map((m) => m.meeting_id).filter(Boolean);
      const counts = new Map<string, number>();
      if (meetingIds.length > 0) {
        const { data: resRows } = await supabase
          .from("meeting_resolutions")
          .select("meeting_id")
          .in("meeting_id", meetingIds);
        for (const r of (resRows ?? []) as { meeting_id: string }[]) {
          counts.set(r.meeting_id, (counts.get(r.meeting_id) ?? 0) + 1);
        }
      }

      return rows.map((m) => ({
        ...m,
        meeting_type: m.meetings?.meeting_type ?? null,
        body_name: m.meetings?.governing_bodies?.name ?? null,
        entity_name: m.meetings?.governing_bodies?.entities?.common_name ?? null,
        resolutions_count: counts.get(m.meeting_id) ?? 0,
      }));
    },
  });
}

export type ActaDetailRow = Omit<ActaRow, "meeting_type" | "body_name" | "entity_name" | "resolutions_count"> & {
  meetings?: {
    meeting_type?: string | null;
    scheduled_start?: string | null;
    governing_bodies?: {
      name?: string | null;
      entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
    } | null;
  } | null;
};

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
        .eq("tenant_id", DEMO_TENANT)
        .maybeSingle();
      if (error) throw error;
      return data as ActaDetailRow | null;
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
        .eq("tenant_id", DEMO_TENANT)
        .eq("minute_id", minuteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CertificationRow[];
    },
  });
}
