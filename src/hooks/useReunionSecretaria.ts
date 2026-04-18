import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingSecretariaRow {
  id: string;
  slug: string | null;
  tenant_id: string;
  body_id: string;
  meeting_type: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  president_id: string | null;
  secretary_id: string | null;
  quorum_data: any;
  location: string | null;
  confidentiality_level: string | null;
  body_name: string | null;
  entity_name: string | null;
  jurisdiction: string | null;
  resolutions_count: number;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string;
  person_id: string | null;
  role: string | null;
  attendance_mode: string | null;
  present: boolean | null;
  represented_by_id: string | null;
}

export interface MeetingResolution {
  id: string;
  meeting_id: string;
  agenda_item_index: number;
  resolution_text: string;
  resolution_type: string | null;
  required_majority_code: string | null;
  status: string;
  agreement_id: string | null;
}

export function useReunionesList() {
  return useQuery({
    queryKey: ["secretaria", "meetings", "list"],
    queryFn: async (): Promise<MeetingSecretariaRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "*, governing_bodies(name, entities(common_name, jurisdiction)), meeting_resolutions(id)",
        )
        .order("scheduled_start", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        body_name: m.governing_bodies?.name ?? null,
        entity_name: m.governing_bodies?.entities?.common_name ?? null,
        jurisdiction: m.governing_bodies?.entities?.jurisdiction ?? null,
        resolutions_count: Array.isArray(m.meeting_resolutions) ? m.meeting_resolutions.length : 0,
      }));
    },
  });
}

export function useReunionById(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["secretaria", "meetings", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "*, governing_bodies(name, entities(common_name, jurisdiction, legal_form))",
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useReunionAttendees(meetingId: string | undefined) {
  return useQuery({
    enabled: !!meetingId,
    queryKey: ["meeting_attendees", meetingId],
    queryFn: async (): Promise<MeetingAttendee[]> => {
      const { data, error } = await supabase
        .from("meeting_attendees")
        .select("*")
        .eq("meeting_id", meetingId!);
      if (error) throw error;
      return (data ?? []) as MeetingAttendee[];
    },
  });
}

export function useReunionResolutions(meetingId: string | undefined) {
  return useQuery({
    enabled: !!meetingId,
    queryKey: ["meeting_resolutions", meetingId],
    queryFn: async (): Promise<MeetingResolution[]> => {
      const { data, error } = await supabase
        .from("meeting_resolutions")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("agenda_item_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MeetingResolution[];
    },
  });
}
