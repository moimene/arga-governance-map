import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildMeetingAgreementDraftResetPayload,
  buildMeetingAgreementPayload,
  extractAgendaItemIndexFromExecutionMode,
  isMaterializableMeetingAgreement,
  type AgreementOrigin,
} from "@/lib/secretaria/agreement-360";
import {
  mergeMeetingAgendaSources,
  type ConvocatoriaAgendaItemSource,
  type MeetingAgendaItemSource,
  type MeetingAgendaPoint,
  type PreparedAgreementSource,
} from "@/lib/secretaria/meeting-agenda";
import {
  canUseLegacyConvocatoriaFallback,
  extractMeetingSourceLinks,
} from "@/lib/secretaria/meeting-links";
import type { ConvocatoriaForMeetingSchedule } from "@/lib/secretaria/meeting-scheduler";
import {
  addUniversalMeetingHoursIso,
  buildUniversalMeetingDedupHash,
  buildUniversalMeetingQuorumData,
  buildUniversalMeetingSlug,
  UNIVERSAL_MEETING_INITIAL_STATUS,
  universalMeetingStartIso,
  type UniversalMeetingBasicInput,
} from "@/lib/secretaria/junta-universal";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";
import {
  normalizeAgendaItemKind,
  type AgendaItemKind,
} from "@/lib/secretaria/agenda-kind";
import { computeVocalPersonIds } from "@/lib/secretaria/meeting-census";
import { patchMeetingQuorumCache } from "@/lib/secretaria/meeting-progress";

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
  entity_id: string | null;
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
  shares_represented?: number | null;
  voting_rights?: number | null;
  via_representante: boolean | null;
  tenant_id: string | null;
  full_name?: string | null;
}

export interface BodyMember {
  id: string;
  person_id: string;
  tipo_condicion: string;
  full_name: string;
  /**
   * false para condiciones con voz sin voto (secretario no consejero,
   * letrado asesor): no computan en quórum ni votan (arts. 247-248 LSC).
   */
  es_vocal: boolean;
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

export interface SaveMeetingResolutionInput {
  agenda_item_index: number;
  resolution_text: string;
  resolution_type?: string | null;
  status: string;
  required_majority_code?: string | null;
  agreement_id?: string | null;
  agreement_origin?: AgreementOrigin;
  adoption_snapshot?: MeetingAdoptionSnapshot;
  votes?: Array<{
    attendee_id: string | null;
    vote_value: string;
    conflict_flag: boolean;
    reason: string | null;
  }>;
}

export interface SavedMeetingResolutionPoint {
  agenda_item_index: number;
  resolution_id: string;
  agreement_id: string | null;
  adoption_snapshot?: MeetingAdoptionSnapshot;
}

export interface AgendaItemConstanciaInput {
  agenda_item_id: string;
  kind: AgendaItemKind | string;
  summary?: string | null;
  participants?: Array<Record<string, unknown>>;
  follow_ups?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
}

export interface MeetingForConvocatoria {
  id: string;
  slug: string | null;
  body_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  meeting_type: string;
  location: string | null;
  quorum_data: Record<string, unknown> | null;
  president_id: string | null;
  secretary_id: string | null;
}

export interface MeetingMinuteLink {
  id: string;
  meeting_id: string;
  created_at: string;
  signed_at: string | null;
  is_locked: boolean | null;
}

function dateOnly(value?: string | null) {
  return value ? String(value).slice(0, 10) : null;
}

export type MeetingOpeningAvailability = {
  allowed: boolean;
  reason: string | null;
};

/**
 * Proyección UX del gate autoritativo de apertura. El reloj cliente solo evita
 * una acción inválida evidente; la RPC vuelve a comprobar estos hechos bajo lock.
 */
export function getMeetingOpeningAvailability(
  status: string | null | undefined,
  scheduledStart: string | null | undefined,
  scheduledEnd: string | null | undefined,
  nowMs = Date.now(),
): MeetingOpeningAvailability {
  if (status !== "DRAFT" && status !== "CONVOCADA") {
    return {
      allowed: false,
      reason: "El estado actual de la reunión no permite declarar su apertura.",
    };
  }

  const startMs = scheduledStart ? Date.parse(scheduledStart) : Number.NaN;
  const endMs = scheduledEnd ? Date.parse(scheduledEnd) : Number.NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return {
      allowed: false,
      reason: "El horario previsto no es válido. Corrige el inicio y el fin antes de abrir la sesión.",
    };
  }

  if (startMs > nowMs) {
    return {
      allowed: false,
      reason: "La sesión solo podrá abrirse cuando llegue la fecha y hora de inicio previstas.",
    };
  }

  return { allowed: true, reason: null };
}

function sameTimestamp(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

type SaveMeetingResolutionRpcRow = SaveMeetingResolutionInput & {
  agreement_action: "UPSERT" | "RESET" | "NONE";
  agreement_payload?: Record<string, unknown> | null;
};

type SaveMeetingResolutionRpcResult = {
  agenda_item_index: number;
  resolution_id: string;
  agreement_id: string | null;
  adoption_snapshot?: MeetingAdoptionSnapshot | null;
};

export function useReunionesList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria", tenantId, "meetings", "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<MeetingSecretariaRow[]> => {
      let bodyIds: string[] | null = null;

      if (entityId) {
        const { data: bodies, error: bodiesError } = await supabase
          .from("governing_bodies")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId);

        if (bodiesError) throw bodiesError;
        bodyIds = (bodies ?? []).map((body) => body.id);
        if (bodyIds.length === 0) return [];
      }

      let query = supabase
        .from("meetings")
        .select(
          "*, governing_bodies(name, entity_id, entities(common_name, jurisdiction)), meeting_resolutions(id)",
        )
        .eq("tenant_id", tenantId!)
        .order("scheduled_start", { ascending: false })
        .limit(50);

      if (bodyIds) {
        query = query.in("body_id", bodyIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = Omit<MeetingSecretariaRow, "body_name" | "entity_id" | "entity_name" | "jurisdiction" | "resolutions_count"> & {
        governing_bodies?: {
          name?: string | null;
          entity_id?: string | null;
          entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
        } | null;
        meeting_resolutions?: { id: string }[] | null;
      };
      return ((data ?? []) as Raw[]).map((m) => ({
        ...m,
        body_name: m.governing_bodies?.name ?? null,
        entity_id: m.governing_bodies?.entity_id ?? null,
        entity_name: m.governing_bodies?.entities?.common_name ?? null,
        jurisdiction: m.governing_bodies?.entities?.jurisdiction ?? null,
        resolutions_count: Array.isArray(m.meeting_resolutions) ? m.meeting_resolutions.length : 0,
      }));
    },
  });
}

function nextDateIso(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

async function findMeetingForConvocatoria(
  tenantId: string,
  convocatoriaId: string,
  convocatoria?: ConvocatoriaForMeetingSchedule | null,
) {
  // El vínculo autoritativo vive en agenda_items. Consultarlo primero evita
  // perder reuniones canceladas/rectificadas por límites de listados globales
  // y mantiene la ficha histórica unida a su sesión exacta.
  const { data: agendaLink, error: agendaLinkError } = await supabase
    .from("agenda_items")
    .select("meeting_id")
    .eq("tenant_id", tenantId)
    .eq("source_convocatoria_id", convocatoriaId)
    .limit(1)
    .maybeSingle();
  if (agendaLinkError) throw agendaLinkError;

  if (agendaLink?.meeting_id) {
    const { data: boundMeeting, error: boundMeetingError } = await supabase
      .from("meetings")
      .select("id, slug, body_id, scheduled_start, scheduled_end, status, meeting_type, location, quorum_data, president_id, secretary_id")
      .eq("tenant_id", tenantId)
      .eq("id", agendaLink.meeting_id)
      .maybeSingle();
    if (boundMeetingError) throw boundMeetingError;
    if (boundMeeting) return boundMeeting as MeetingForConvocatoria;
  }

  // Fallback limitado para expedientes legacy aún sin source_convocatoria_id.
  const { data, error } = await supabase
    .from("meetings")
    .select("id, slug, body_id, scheduled_start, scheduled_end, status, meeting_type, location, quorum_data, president_id, secretary_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const rows = (data ?? []) as MeetingForConvocatoria[];
  return rows.find((meeting) => {
    const links = extractMeetingSourceLinks(meeting.quorum_data);
    return links.convocatoria_id === convocatoriaId || (links.convocatoria_ids ?? []).includes(convocatoriaId);
  }) ?? findMeetingByBodyAndTimestamp(rows, convocatoriaId, convocatoria) ?? null;
}

function findMeetingByBodyAndTimestamp(
  rows: MeetingForConvocatoria[],
  convocatoriaId: string,
  convocatoria?: ConvocatoriaForMeetingSchedule | null,
) {
  if (!convocatoria?.body_id || !convocatoria.fecha_1) return null;
  return rows.find((meeting) => (
    meeting.body_id === convocatoria.body_id
    && sameTimestamp(meeting.scheduled_start, convocatoria.fecha_1)
    && canUseLegacyConvocatoriaFallback(meeting.quorum_data, convocatoriaId)
  )) ?? null;
}

export function useMeetingForConvocatoria(
  convocatoriaId: string | undefined,
  convocatoria?: ConvocatoriaForMeetingSchedule | null,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!convocatoriaId,
    queryKey: [
      "secretaria",
      tenantId,
      "meetings",
      "by-convocatoria",
      convocatoriaId,
      convocatoria?.body_id ?? "no-body",
      dateOnly(convocatoria?.fecha_1) ?? "no-date",
    ],
    queryFn: async (): Promise<MeetingForConvocatoria | null> => {
      if (!tenantId || !convocatoriaId) return null;
      const linked = await findMeetingForConvocatoria(tenantId, convocatoriaId, convocatoria);
      if (linked || !convocatoria?.body_id || !convocatoria.fecha_1) return linked;

      const { data, error } = await supabase
        .from("meetings")
        .select("id, slug, body_id, scheduled_start, scheduled_end, status, meeting_type, location, quorum_data")
        .eq("tenant_id", tenantId)
        .eq("body_id", convocatoria.body_id)
        .eq("scheduled_start", convocatoria.fecha_1)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return findMeetingByBodyAndTimestamp(
        (data ?? []) as MeetingForConvocatoria[],
        convocatoriaId,
        convocatoria,
      );
    },
    staleTime: 20_000,
  });
}

export function useCreateMeetingFromConvocatoria() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (convocatoria: ConvocatoriaForMeetingSchedule): Promise<{ id: string; reused: boolean }> => {
      if (!tenantId) throw new Error("Tenant no disponible");
      if (convocatoria.tenant_id !== tenantId) {
        throw new Error("La convocatoria no pertenece al tenant activo.");
      }

      // Una única RPC crea/reutiliza meetings, completa cargos y
      // materializa/reconcilia agenda_items dentro de la misma transacción.
      // No existe INSERT/UPDATE cliente que pueda dejar una reunión huérfana
      // si falla el binding de la agenda inmutable.
      const { data, error } = await supabase.rpc(
        "fn_secretaria_create_or_reuse_meeting_from_convocation",
        { p_convocatoria_id: convocatoria.id },
      );
      if (error) {
        throw new Error(`No se pudo programar la reunión autoritativa: ${error.message}`);
      }

      const result = data as {
        id?: string;
        meeting_id?: string;
        reused?: boolean;
        materialized_items?: number;
      } | null;
      const meetingId = result?.meeting_id ?? result?.id;
      if (!meetingId) {
        throw new Error("La programación autoritativa no devolvió una reunión.");
      }
      const expectedItems = convocatoria.agenda_items?.length ?? 0;
      if (result?.materialized_items !== expectedItems) {
        throw new Error(
          "La agenda materializada no coincide en cardinalidad con la convocatoria inmutable.",
        );
      }
      return { id: meetingId, reused: result?.reused === true };
    },
    onSuccess: (_result, convocatoria) => {
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings"] });
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings", "by-convocatoria", convocatoria.id] });
    },
  });
}

export type CreateUniversalMeetingInput = Omit<UniversalMeetingBasicInput, "tenantId">;

export function useCreateUniversalMeeting() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUniversalMeetingInput): Promise<{ id: string; reused: boolean }> => {
      if (!tenantId) throw new Error("Tenant no disponible");
      if (!input.entityId || !input.bodyId) {
        throw new Error("Selecciona sociedad y órgano social antes de crear la reunión universal.");
      }
      if (!input.fecha || !input.horaInicio || !input.lugar.trim() || !input.modalidad) {
        throw new Error("Fecha, hora, lugar y modalidad son obligatorios para la reunión universal.");
      }

      const hydrated: UniversalMeetingBasicInput = { ...input, tenantId };
      const scheduledStart = universalMeetingStartIso(input.fecha, input.horaInicio);
      const scheduledEnd = addUniversalMeetingHoursIso(scheduledStart, 2);
      const dedupHash = buildUniversalMeetingDedupHash(hydrated);

      const { data: candidates, error: candidatesError } = await supabase
        .from("meetings")
        .select("id, quorum_data")
        .eq("tenant_id", tenantId)
        .eq("body_id", input.bodyId)
        .gte("scheduled_start", `${input.fecha}T00:00:00.000Z`)
        .lt("scheduled_start", nextDateIso(input.fecha))
        .order("created_at", { ascending: false })
        .limit(20);
      if (candidatesError) throw candidatesError;

      const existing = ((candidates ?? []) as Array<{ id: string; quorum_data?: Record<string, unknown> | null }>)
        .find((meeting) => {
          const universalIntake = meeting.quorum_data?.universal_intake as Record<string, unknown> | undefined;
          return universalIntake?.dedup_hash === dedupHash;
        });
      if (existing) return { id: existing.id, reused: true };

      const { data, error } = await supabase
        .from("meetings")
        .insert({
          tenant_id: tenantId,
          body_id: input.bodyId,
          slug: buildUniversalMeetingSlug(hydrated, dedupHash),
          meeting_type: "UNIVERSAL",
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          status: UNIVERSAL_MEETING_INITIAL_STATUS,
          location: input.lugar.trim(),
          confidentiality_level: "NORMAL",
          quorum_data: buildUniversalMeetingQuorumData(hydrated),
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: (data as { id: string }).id, reused: false };
    },
    onSuccess: (_result, input) => {
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings"] });
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings", "list", input.entityId] });
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
          "*, governing_bodies(name, body_type, entity_id, quorum_rule, entities(common_name, legal_name, jurisdiction, legal_form, tipo_social, es_cotizada))",
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
        .select("*, person:person_id(full_name)")
        .eq("tenant_id", tenantId!)
        .eq("meeting_id", meetingId!);
      if (error) throw error;
      type MeetingAttendeeRaw = MeetingAttendee & {
        person?: { full_name?: string | null } | null;
      };
      return ((data ?? []) as MeetingAttendeeRaw[]).map((attendee) => ({
        ...attendee,
        full_name: attendee.person?.full_name ?? attendee.full_name ?? null,
      }));
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

export function useMinuteForMeeting(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!meetingId,
    queryKey: ["actas", tenantId, "byMeeting", meetingId],
    queryFn: async (): Promise<MeetingMinuteLink | null> => {
      if (!tenantId || !meetingId) return null;
      const { data, error } = await supabase
        .from("minutes")
        .select("id, meeting_id, created_at, signed_at, is_locked")
        .eq("tenant_id", tenantId)
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as MeetingMinuteLink | null) ?? null;
    },
    staleTime: 10_000,
  });
}

export function useMeetingAgendaSources(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["secretaria", tenantId, "meetings", meetingId, "agenda-sources"],
    queryFn: async (): Promise<MeetingAgendaPoint[]> => {
      const { data: meetingData, error: meetingErr } = await supabase
        .from("meetings")
        .select("id, tenant_id, body_id, scheduled_start, quorum_data")
        .eq("tenant_id", tenantId!)
        .eq("id", meetingId!)
        .maybeSingle();
      if (meetingErr) throw meetingErr;
      if (!meetingData) return [];

      const meeting = meetingData as {
        body_id?: string | null;
        scheduled_start?: string | null;
        quorum_data?: Record<string, unknown> | null;
      };
      const meetingDate = dateOnly(meeting.scheduled_start);
      const explicitLinks = extractMeetingSourceLinks(meeting.quorum_data);
      const explicitConvocatoriaId = explicitLinks.convocatoria_id;
      const explicitAgreementIds = explicitLinks.agreement_ids ?? [];

      const [agendaRes, convocatoriaRes, agreementsRes] = await Promise.all([
        supabase
          .from("agenda_items")
          // kind + decision_subtype necesarios para que mergeMeetingAgendaSources
          // propague la clasificación a debates/votación (sin ellos, source.kind
          // viene undefined y el merge cae a DELIBERATIVO por defecto — Codex P2
          // round 2 + reviewer adversarial C1).
          .select("id, order_number, title, description, matter_code, kind, decision_subtype, proposal_text, requires_attachments")
          .eq("meeting_id", meetingId!)
          .order("order_number", { ascending: true }),
        explicitConvocatoriaId
          ? supabase
              .from("convocatorias")
              .select("id, agenda_items, fecha_emision")
              .eq("tenant_id", tenantId!)
              .eq("id", explicitConvocatoriaId)
              .limit(1)
          : meeting.body_id && meetingDate
          ? supabase
              .from("convocatorias")
              .select("id, agenda_items, fecha_emision")
              .eq("tenant_id", tenantId!)
              .eq("body_id", meeting.body_id)
              .eq("fecha_1", meetingDate)
              .order("fecha_emision", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        (async () => {
          const { data: byMeeting, error: byMeetingError } = await supabase
            .from("agreements")
            .select("id, agreement_kind, matter_class, proposal_text, decision_text, status, compliance_snapshot, compliance_explain")
            .eq("tenant_id", tenantId!)
            .eq("parent_meeting_id", meetingId!)
            .in("status", ["DRAFT", "PROPOSED"]);
          if (byMeetingError) return { data: null, error: byMeetingError };

          if (explicitAgreementIds.length === 0) {
            return { data: byMeeting ?? [], error: null };
          }

          const { data: byExplicitIds, error: byIdsError } = await supabase
            .from("agreements")
            .select("id, agreement_kind, matter_class, proposal_text, decision_text, status, compliance_snapshot, compliance_explain")
            .eq("tenant_id", tenantId!)
            .in("id", explicitAgreementIds)
            .in("status", ["DRAFT", "PROPOSED"]);
          if (byIdsError) return { data: null, error: byIdsError };

          const byId = new Map<string, unknown>();
          for (const row of [...(byMeeting ?? []), ...(byExplicitIds ?? [])]) {
            byId.set((row as { id: string }).id, row);
          }
          return { data: Array.from(byId.values()), error: null };
        })(),
      ]);

      if (agendaRes.error) throw agendaRes.error;
      if (convocatoriaRes.error) throw convocatoriaRes.error;
      if (agreementsRes.error) throw agreementsRes.error;

      const convocatoria = ((convocatoriaRes.data ?? []) as Array<{
        id: string;
        agenda_items?: ConvocatoriaAgendaItemSource[] | null;
      }>)[0];

      return mergeMeetingAgendaSources({
        savedDebates: (meeting.quorum_data?.debates ?? []) as unknown[],
        agendaItems: (agendaRes.data ?? []) as MeetingAgendaItemSource[],
        convocatoriaId: convocatoria?.id ?? null,
        convocatoriaItems: Array.isArray(convocatoria?.agenda_items) ? convocatoria.agenda_items : [],
        preparedAgreements: (agreementsRes.data ?? []) as PreparedAgreementSource[],
      });
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
        .select("id, person_id, tipo_condicion, person:person_id(full_name)")
        .eq("body_id", bodyId!)
        .eq("estado", "VIGENTE")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      type Raw = {
        id: string;
        person_id: string;
        tipo_condicion: string;
        person?: { full_name?: string | null } | null;
      };
      const rows = (data ?? []) as Raw[];
      // ITEM-028/037: el secretario no consejero (y análogos) asiste con voz
      // sin voto — se marca para excluirlo de quórum, votación y representación.
      const vocalIds = computeVocalPersonIds(rows);
      return rows.map((r) => ({
        id: r.id,
        person_id: r.person_id,
        tipo_condicion: r.tipo_condicion,
        full_name: r.person?.full_name ?? "Sin nombre",
        es_vocal: vocalIds.has(r.person_id),
      }));
    },
  });
}

// ITEM-146: "Declarar apertura" transiciona la reunión a EN_CURSO (sesión
// abierta), NO a CELEBRADA. CELEBRADA se reserva para el cierre atómico con
// snapshot WORM y acta (vía useGenerarActa). Antes una sesión abierta y abandonada quedaba
// "Celebrada" sin asistentes/quórum/acta, distorsionando KPIs y el lenguaje de
// estado. El CHECK de meetings.status y los guards de agenda (reclassify) admiten
// EN_CURSO desde la migración 20260613120000/120500.
export function useOpenMeeting(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!meetingId || !tenantId) {
        throw new Error("No se puede abrir la sesión sin reunión y tenant activos.");
      }

      const { data, error } = await supabase.rpc("fn_secretaria_open_meeting", {
        p_meeting_id: meetingId,
      });
      if (error) {
        throw new Error(`No se pudo abrir la sesión: ${error.message}`);
      }

      const result = data as {
        meeting_id?: string;
        status?: string;
      } | null;
      if (result?.meeting_id !== meetingId || result.status !== "EN_CURSO") {
        throw new Error("La apertura autoritativa no confirmó el estado EN CURSO.");
      }
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
      rows: Array<{
        person_id: string;
        attendance_type: string;
        represented_by_id: string | null;
        capital_representado?: number | null;
        shares_represented?: number | null;
        voting_rights?: number | null;
        via_representante?: boolean | null;
      }>
    ) => {
      if (!meetingId || !tenantId) return;

      // Purgar meeting_votes que referencian los attendees actuales.
      // FK `meeting_votes_attendee_id_fkey` no es ON DELETE CASCADE, así
      // que si el meeting tiene votos previos (re-edición de asistencia
      // tras haber votado), el DELETE de meeting_attendees fallaría con
      // FK violation 23503. Bug detectado en e2e/18 golden path.
      const { data: existingIds, error: idErr } = await supabase
        .from("meeting_attendees")
        .select("id")
        .eq("meeting_id", meetingId)
        .eq("tenant_id", tenantId);
      if (idErr) throw idErr;
      const ids = (existingIds ?? []).map((r) => r.id);
      if (ids.length > 0) {
        const { error: votesErr } = await supabase
          .from("meeting_votes")
          .delete()
          .in("attendee_id", ids)
          .eq("tenant_id", tenantId);
        if (votesErr) throw votesErr;
      }

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
      // VotacionesStep cachea meeting_attendees bajo otra key
      // (["secretaria", tenantId, "meetings", meetingId, "votaciones"]) y
      // necesita refetch con los IDs nuevos tras delete+insert. Sin esto,
      // los votos viajan con `attendee_id` obsoletos y el RPC
      // fn_save_meeting_resolutions revienta con FK violation 23503 sobre
      // meeting_votes_attendee_id_fkey. Bug detectado en e2e/49.
      qc.invalidateQueries({
        queryKey: ["secretaria", tenantId, "meetings", meetingId, "votaciones"],
      });
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
    onSuccess: (_result, quorumData) => {
      const meetingKey = ["secretaria", tenantId, "meetings", "byId", meetingId] as const;
      qc.setQueryData(meetingKey, (current) => patchMeetingQuorumCache(current, quorumData));
      qc.invalidateQueries({ queryKey: meetingKey });
    },
  });
}

export function useReplaceAgendaItemConstancias(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rows: AgendaItemConstanciaInput[]) => {
      if (!meetingId || !tenantId) return [];

      const { error: deleteError } = await supabase
        .from("agenda_item_constancias")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("meeting_id", meetingId);
      if (deleteError) throw deleteError;

      const payload = rows
        .map((row) => {
          const kind = normalizeAgendaItemKind(row.kind);
          if (kind === "DECISORIO") return null;
          return {
            tenant_id: tenantId,
            meeting_id: meetingId,
            agenda_item_id: row.agenda_item_id,
            kind,
            summary: row.summary ?? null,
            participants: row.participants ?? [],
            follow_ups: row.follow_ups ?? [],
            attachments: row.attachments ?? [],
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (payload.length === 0) return [];

      const { data, error } = await supabase
        .from("agenda_item_constancias")
        .insert(payload)
        .select("id, agenda_item_id");
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings", "byId", meetingId] });
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings", meetingId, "agenda-sources"] });
      qc.invalidateQueries({ queryKey: ["actas", tenantId, "agenda_contract", meetingId] });
    },
  });
}

export function useSaveMeetingResolutions(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SaveMeetingResolutionInput[]): Promise<SavedMeetingResolutionPoint[]> => {
      if (!meetingId || !tenantId) return [];
      const { data: meetingData, error: meetingErr } = await supabase
        .from("meetings")
        .select("scheduled_start, body_id, governing_bodies(entity_id)")
        .eq("id", meetingId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (meetingErr) throw meetingErr;

      type MeetingForAgreement = {
        scheduled_start?: string | null;
        body_id?: string | null;
        governing_bodies?: { entity_id?: string | null } | null;
      } | null;
      const meetingForAgreement = meetingData as MeetingForAgreement;
      const bodyId = meetingForAgreement?.body_id ?? null;
      const entityId = meetingForAgreement?.governing_bodies?.entity_id ?? null;

      const { data: agendaRows, error: agendaRowsErr } = await supabase
        .from("agenda_items")
        .select("id, order_number, kind")
        .eq("meeting_id", meetingId)
        .eq("tenant_id", tenantId);
      if (agendaRowsErr) throw agendaRowsErr;
      const agendaByOrder = new Map(
        ((agendaRows ?? []) as Array<{ id: string; order_number: number; kind: string }>)
          .map((row) => [row.order_number, row])
      );

      const { data: existingResolutionIds, error: existingErr } = await supabase
        .from("meeting_resolutions")
        .select("id, agenda_item_index, agreement_id")
        .eq("meeting_id", meetingId)
        .eq("tenant_id", tenantId);
      if (existingErr) throw existingErr;

      const existingAgreementByPoint = new Map<number, string>();
      (existingResolutionIds ?? []).forEach((row) => {
        if (row.agreement_id) existingAgreementByPoint.set(row.agenda_item_index, row.agreement_id);
      });

      const { data: existingAgreements, error: existingAgreementsErr } = await supabase
        .from("agreements")
        .select("id, execution_mode")
        .eq("tenant_id", tenantId)
        .eq("parent_meeting_id", meetingId);
      if (existingAgreementsErr) throw existingAgreementsErr;

      (existingAgreements ?? []).forEach((agreement) => {
        const agendaItemIndex = extractAgendaItemIndexFromExecutionMode(
          (agreement as { execution_mode?: unknown }).execution_mode
        );
        if (agendaItemIndex && !existingAgreementByPoint.has(agendaItemIndex)) {
          existingAgreementByPoint.set(agendaItemIndex, agreement.id);
        }
      });

      const rpcRows: SaveMeetingResolutionRpcRow[] = rows.map((row) => {
          const existingAgreementId =
            row.agreement_id ?? existingAgreementByPoint.get(row.agenda_item_index) ?? null;
          let agreementPayload: Record<string, unknown> | null = null;
          let agreementAction: SaveMeetingResolutionRpcRow["agreement_action"] = "NONE";

          if (row.adoption_snapshot && isMaterializableMeetingAgreement(row.adoption_snapshot)) {
            if (!entityId || !bodyId) {
              throw new Error("No se puede materializar el acuerdo: falta entidad u órgano de la reunión.");
            }
            const agendaItem = agendaByOrder.get(row.agenda_item_index);
            if (!agendaItem?.id || agendaItem.kind !== "DECISORIO") {
              throw new Error("Solo un punto decisorio puede materializarse como Acuerdo 360.");
            }
            const payload = buildMeetingAgreementPayload({
              tenantId,
              entityId,
              bodyId,
              meetingId,
              agendaItemId: agendaItem.id,
              scheduledStart: meetingForAgreement?.scheduled_start,
              snapshot: row.adoption_snapshot,
              resolutionText: row.resolution_text,
              requiredMajorityCode: row.required_majority_code,
              origin: row.agreement_origin ?? "MEETING_FLOOR",
            });

            if (payload) {
              agreementPayload = payload;
              agreementAction = "UPSERT";
            }
          } else if (row.adoption_snapshot && existingAgreementId && entityId && bodyId) {
            const agendaItem = agendaByOrder.get(row.agenda_item_index);
            agreementPayload = buildMeetingAgreementDraftResetPayload({
              tenantId,
              entityId,
              bodyId,
              meetingId,
              agendaItemId: agendaItem?.id ?? null,
              scheduledStart: meetingForAgreement?.scheduled_start,
              snapshot: row.adoption_snapshot,
              resolutionText: row.resolution_text,
              requiredMajorityCode: row.required_majority_code,
              origin: row.agreement_origin ?? "MEETING_FLOOR",
            });
            agreementAction = "RESET";
          }

        return {
          ...row,
          agreement_id: existingAgreementId,
          agreement_action: agreementAction,
          agreement_payload: agreementPayload,
        };
      });

      const { data: saved, error: saveErr } = await supabase.rpc("fn_save_meeting_resolutions", {
        p_tenant_id: tenantId,
        p_meeting_id: meetingId,
        p_rows: rpcRows,
      });
      if (saveErr) throw saveErr;

      return ((saved ?? []) as SaveMeetingResolutionRpcResult[]).map((row) => ({
        agenda_item_index: row.agenda_item_index,
        resolution_id: row.resolution_id,
        agreement_id: row.agreement_id ?? null,
        adoption_snapshot: row.adoption_snapshot ?? undefined,
      }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting_resolutions", tenantId, meetingId] });
      qc.invalidateQueries({ queryKey: ["meeting_votes", tenantId, meetingId] });
      qc.invalidateQueries({ queryKey: ["rule_evaluation_results", tenantId] });
      qc.invalidateQueries({ queryKey: ["agreements", tenantId] });
      qc.invalidateQueries({ queryKey: ["agreement", tenantId] });
    },
  });
}

export function useGenerarActa() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      meetingId,
      content,
      canonicalMinutesHash,
    }: {
      meetingId: string;
      content: string;
      canonicalMinutesHash?: string | null;
    }) => {
      if (!tenantId) throw new Error("No se pudo resolver el tenant activo para cerrar la reunión.");

      const { data, error } = await supabase.rpc("fn_secretaria_close_meeting_and_generate_minute", {
        p_meeting_id: meetingId,
        p_content: content,
        p_canonical_minutes_hash: canonicalMinutesHash ?? null,
      });
      if (error) throw error;
      if (!data) throw new Error("La operación atómica no devolvió el acta autoritativa.");
      return data as string;
    },
    onSuccess: (_minuteId, variables) => {
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings"] });
      qc.invalidateQueries({ queryKey: ["secretaria", tenantId, "meetings", "byId", variables.meetingId] });
      qc.invalidateQueries({ queryKey: ["actas", tenantId, "byMeeting", variables.meetingId] });
      qc.invalidateQueries({ queryKey: ["censo_snapshot", tenantId, variables.meetingId] });
    },
  });
}
