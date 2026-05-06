import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { isOperationalSecretariaBody } from "@/lib/secretaria/operational-bodies";

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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export function useBodiesList() {
  return useQuery({
    queryKey: ["governing_bodies", "list"],
    queryFn: async (): Promise<BodyListRow[]> => {
      // F6.1: miembros vienen de condiciones_persona (SSOT canónica),
      // no de mandates. Filtro por estado='VIGENTE' (equivalente al
      // legacy status='Activo').
      const { data, error } = await supabase
        .from("governing_bodies")
        .select(
          "*, entity:entity_id(common_name, slug), condiciones_persona(id, estado)"
        )
        .order("name", { ascending: true });
      if (error) throw error;
      type BodyRaw = BodyListRow & {
        entity?: { common_name?: string | null; slug?: string | null } | null;
        condiciones_persona?: Array<{ id: string; estado: string | null }> | null;
      };
      return ((data ?? []) as BodyRaw[])
        .filter(isOperationalSecretariaBody)
        .map((b) => ({
          ...b,
          entity_name: b.entity?.common_name ?? null,
          entity_slug: b.entity?.slug ?? null,
          member_count: (b.condiciones_persona ?? []).filter(
            (m) => m.estado === "VIGENTE"
          ).length,
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
      return (data as BodyRow | null) ?? null;
    },
  });
}

export function useBodyMandates(bodyId: string | undefined) {
  return useQuery({
    enabled: !!bodyId,
    queryKey: ["condiciones_persona", "byBody", bodyId],
    queryFn: async (): Promise<MandateRow[]> => {
      // F6.1: leer de condiciones_persona, mapear al shape MandateRow
      // (contrato legacy) para que OrganoDetalle y demás consumidores
      // sigan funcionando sin cambios.
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select(
          "id, body_id, person_id, tipo_condicion, fecha_inicio, fecha_fin, estado, person:person_id(full_name, email)"
        )
        .eq("body_id", bodyId!)
        .order("tipo_condicion", { ascending: true });
      if (error) throw error;
      type CondRaw = {
        id: string;
        body_id: string;
        person_id: string;
        tipo_condicion: string | null;
        fecha_inicio: string | null;
        fecha_fin: string | null;
        estado: string | null;
        person?: { full_name?: string | null; email?: string | null } | null;
      };
      return ((data ?? []) as CondRaw[]).map((m) => ({
        id: m.id,
        body_id: m.body_id,
        person_id: m.person_id,
        role: m.tipo_condicion,
        type: null,
        start_date: m.fecha_inicio,
        end_date: m.fecha_fin,
        status: m.estado === "VIGENTE" ? "Activo" : "Cesado",
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
      type MeetingRaw = MeetingRow & {
        president?: { full_name?: string | null } | null;
        secretary?: { full_name?: string | null } | null;
      };
      const m = data as MeetingRaw;
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
    queryKey: ["condiciones_persona", "active", bodyId],
    queryFn: async (): Promise<MandateRow[]> => {
      // F6.1: participantes vigentes vienen de condiciones_persona
      // (estado='VIGENTE') con el shape MandateRow para compatibilidad.
      const { data, error } = await supabase
        .from("condiciones_persona")
        .select(
          "id, body_id, person_id, tipo_condicion, fecha_inicio, fecha_fin, estado, person:person_id(full_name, email)"
        )
        .eq("body_id", bodyId!)
        .eq("estado", "VIGENTE");
      if (error) throw error;
      type CondRaw = {
        id: string;
        body_id: string;
        person_id: string;
        tipo_condicion: string | null;
        fecha_inicio: string | null;
        fecha_fin: string | null;
        estado: string | null;
        person?: { full_name?: string | null; email?: string | null } | null;
      };
      return ((data ?? []) as CondRaw[]).map((m) => ({
        id: m.id,
        body_id: m.body_id,
        person_id: m.person_id,
        role: m.tipo_condicion,
        type: null,
        start_date: m.fecha_inicio,
        end_date: m.fecha_fin,
        status: m.estado === "VIGENTE" ? "Activo" : "Cesado",
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

export interface BodySlim {
  id: string;
  slug: string;
  name: string;
  body_type: string;
  config?: Record<string, unknown> | null;
}

export function useBodiesByEntity(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["governing_bodies", "byEntity", entityId, tenantId],
    queryFn: async (): Promise<BodySlim[]> => {
      const { data, error } = await supabase
        .from("governing_bodies")
        .select("id, slug, name, body_type, config")
        .eq("entity_id", entityId!)
        .eq("tenant_id", tenantId!)
        .order("name");
      if (error) throw error;
      return ((data ?? []) as BodySlim[]).filter(isOperationalSecretariaBody);
    },
  });
}
