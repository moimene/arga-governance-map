import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

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
  quorum_data: Record<string, unknown> | null;
  location: string | null;
  confidentiality_level: string | null;
  body_name: string | null;
  entity_name: string | null;
  jurisdiction: string | null;
  resolutions_count: number;
}

export interface MeetingAttendee {
  id: string;
  meeting_id: string | null;
  person_id: string | null;
  attendance_type: string;
  represented_by_id: string | null;
  capital_representado: number | null;
  via_representante: boolean | null;
  tenant_id: string | null;
}

export interface BodyMember {
  id: string;
  person_id: string;
  tipo_condicion: string;
  full_name: string;
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
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria", tenantId, "meetings", "list"],
    enabled: !!tenantId,
    queryFn: async (): Promise<MeetingSecretariaRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "*, governing_bodies(name, entities(common_name, jurisdiction)), meeting_resolutions(id)",
        )
        .eq("tenant_id", tenantId!)
        .order("scheduled_start", { ascending: false })
        .limit(50);
      if (error) throw error;
      type Raw = Omit<MeetingSecretariaRow, "body_name" | "entity_name" | "jurisdiction" | "resolutions_count"> & {
        governing_bodies?: {
          name?: string | null;
          entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
        } | null;
        meeting_resolutions?: { id: string }[] | null;
      };
      return ((data ?? []) as Raw[]).map((m) => ({
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
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["secretaria", tenantId, "meetings", "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "*, governing_bodies(name, entities(common_name, jurisdiction, legal_form))",
        )
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useReunionAttendees(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["meeting_attendees", tenantId, meetingId],
    queryFn: async (): Promise<MeetingAttendee[]> => {
      const { data, error } = await supabase
        .from("meeting_attendees")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("meeting_id", meetingId!);
      if (error) throw error;
      return (data ?? []) as MeetingAttendee[];
    },
  });
}

export function useReunionResolutions(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["meeting_resolutions", tenantId, meetingId],
    queryFn: async (): Promise<MeetingResolution[]> => {
      const { data, error } = await supabase
        .from("meeting_resolutions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("meeting_id", meetingId!)
        .order("agenda_item_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MeetingResolution[];
    },
  });
}

export function useBodyMembers(bodyId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!bodyId && !!tenantId,
    queryKey: ["condiciones_persona", tenantId, "body", bodyId],
    queryFn: async (): Promise<BodyMember[]> => {
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select("id, person_id, tipo_condicion, persons(full_name)")
        .eq("body_id", bodyId!)
        .eq("estado", "VIGENTE")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      type Raw = {
        id: string;
        person_id: string;
        tipo_condicion: string;
        persons?: { full_name?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((r) => ({
        id: r.id,
        person_id: r.person_id,
        tipo_condicion: r.tipo_condicion,
        full_name: r.persons?.full_name ?? "Sin nombre",
      }));
    },
  });
}

export function useOpenMeeting(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!meetingId || !tenantId) return;
      const { error } = await supabase
        .from("meetings")
        .update({ status: "OPEN" })
        .eq("id", meetingId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings"] });
    },
  });
}

export function useReplaceAttendees(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: Array<{ person_id: string; attendance_type: string; represented_by_id: string | null }>
    ) => {
      if (!meetingId || !tenantId) return;
      const { error: delErr } = await supabase
        .from("meeting_attendees")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("tenant_id", tenantId);
      if (delErr) throw delErr;
      if (rows.length === 0) return;
      const { error: insErr } = await supabase
        .from("meeting_attendees")
        .insert(rows.map((r) => ({ ...r, meeting_id: meetingId, tenant_id: tenantId })));
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting_attendees", tenantId, meetingId] });
    },
  });
}

export function useUpdateQuorumData(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quorum_data: Record<string, unknown>) => {
      if (!meetingId || !tenantId) return;
      const { error } = await supabase
        .from("meetings")
        .update({ quorum_data })
        .eq("id", meetingId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings", "byId", meetingId] });
    },
  });
}

export function useSaveMeetingResolutions(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rows: Array<{
        agenda_item_index: number;
        resolution_text: string;
        resolution_type?: string | null;
        status: string;
        required_majority_code?: string | null;
      }>
    ) => {
      if (!meetingId || !tenantId) return;
      const { error: delErr } = await supabase
        .from("meeting_resolutions")
        .delete()
        .eq("meeting_id", meetingId)
        .eq("tenant_id", tenantId);
      if (delErr) throw delErr;
      if (rows.length === 0) return;
      const { error: insErr } = await supabase
        .from("meeting_resolutions")
        .insert(rows.map((r) => ({ ...r, meeting_id: meetingId, tenant_id: tenantId })));
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting_resolutions", tenantId, meetingId] });
    },
  });
}

export function useGenerarActa() {
  return useMutation({
    mutationFn: async ({ meetingId, content }: { meetingId: string; content: string }) => {
      const { data, error } = await supabase.rpc("fn_generar_acta", {
        p_meeting_id: meetingId,
        p_content: content,
        p_snapshot_id: null,
      });
      if (error) throw error;
      return data as string;
    },
  });
}
