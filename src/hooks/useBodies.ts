import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BodyListRow {
  id: string;
  slug: string;
  entity_id: string;
  name: string;
  body_type: string;
  regulation_id: string | null;
  quorum: string | null;
  frequency: string | null;
  secretary: string | null;
  status: string | null;
  next_meeting_date: string | null;
  alerts_count: number | null;
  entity_name: string | null;
  entity_slug: string | null;
  member_count: number;
  [key: string]: any;
}

export interface BodyRow {
  id: string;
  slug: string;
  entity_id: string;
  name: string;
  body_type: string;
  regulation_id: string | null;
  quorum: string | null;
  frequency: string | null;
  secretary: string | null;
  status: string | null;
  next_meeting_date: string | null;
  [key: string]: any;
}

export interface MandateRow {
  id: string;
  body_id: string;
  person_id: string;
  role: string | null;
  type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  full_name: string | null;
  email: string | null;
  [key: string]: any;
}

export interface MeetingRow {
  id: string;
  slug: string;
  body_id: string;
  scheduled_start: string | null;
  status: string | null;
  modality: string | null;
  venue: string | null;
  minutes_status: string | null;
  president_id: string | null;
  secretary_id: string | null;
  president_name?: string | null;
  secretary_name?: string | null;
  [key: string]: any;
}

export interface AgendaItemRow {
  id: string;
  meeting_id: string;
  order_number: number;
  title: string;
  type: string | null;
  status: string | null;
  related_object: string | null;
  notes: string | null;
  [key: string]: any;
}

export function useBodiesList() {
  return useQuery({
    queryKey: ["governing_bodies", "list"],
    queryFn: async (): Promise<BodyListRow[]> => {
      const { data, error } = await supabase
        .from("governing_bodies")
        .select("*, entity:entity_id(common_name, slug), mandates(id, status)")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((b: any) => ({
        ...b,
        entity_name: b.entity?.common_name ?? null,
        entity_slug: b.entity?.slug ?? null,
        member_count: (b.mandates ?? []).filter((m: any) => m.status === "Activo").length,
      }));
    },
  });
}

export function useBodyBySlug(slug: string | undefined) {
  return useQuery({
    enabled: !!slug,
    queryKey: ["governing_bodies", "bySlug", slug],
    queryFn: async (): Promise<BodyRow | null> => {
      const { data, error } = await supabase
        .from("governing_bodies")
        .select("*, entity:entity_id(id, common_name, slug, legal_name)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export function useBodyMandates(bodyId: string | undefined) {
  return useQuery({
    enabled: !!bodyId,
    queryKey: ["mandates", "byBody", bodyId],
    queryFn: async (): Promise<MandateRow[]> => {
      const { data, error } = await supabase
        .from("mandates")
        .select("*, person:person_id(full_name, email)")
        .eq("body_id", bodyId!)
        .order("role", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        full_name: m.person?.full_name ?? null,
        email: m.person?.email ?? null,
      }));
    },
  });
}

export function useBodyMeetings(bodyId: string | undefined) {
  return useQuery({
    enabled: !!bodyId,
    queryKey: ["meetings", "byBody", bodyId],
    queryFn: async (): Promise<MeetingRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("body_id", bodyId!)
        .order("scheduled_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MeetingRow[];
    },
  });
}

export function useMeetingBySlug(meetingSlug: string | undefined) {
  return useQuery({
    enabled: !!meetingSlug,
    queryKey: ["meetings", "bySlug", meetingSlug],
    queryFn: async (): Promise<MeetingRow | null> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, president:president_id(full_name), secretary:secretary_id(full_name)")
        .eq("slug", meetingSlug!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const m: any = data;
      return {
        ...m,
        president_name: m.president?.full_name ?? null,
        secretary_name: m.secretary?.full_name ?? null,
      };
    },
  });
}

export function useMeetingAgenda(meetingId: string | undefined) {
  return useQuery({
    enabled: !!meetingId,
    queryKey: ["agenda_items", "byMeeting", meetingId],
    queryFn: async (): Promise<AgendaItemRow[]> => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("order_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgendaItemRow[];
    },
  });
}

export function useMeetingParticipants(bodyId: string | undefined) {
  return useQuery({
    enabled: !!bodyId,
    queryKey: ["mandates", "active", bodyId],
    queryFn: async (): Promise<MandateRow[]> => {
      const { data, error } = await supabase
        .from("mandates")
        .select("*, person:person_id(full_name, email)")
        .eq("body_id", bodyId!)
        .eq("status", "Activo");
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        ...m,
        full_name: m.person?.full_name ?? null,
        email: m.person?.email ?? null,
      }));
    },
  });
}

const ddmmyyyy = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const hhmm = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const formatDate = ddmmyyyy;
export const formatTime = hhmm;
