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
import { extractMeetingSourceLinks } from "@/lib/secretaria/meeting-links";
import {
  buildMeetingScheduleFromConvocatoria,
  type ConvocatoriaForMeetingSchedule,
} from "@/lib/secretaria/meeting-scheduler";
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
  const { data, error } = await supabase
    .from("meetings")
    .select("id, slug, body_id, scheduled_start, scheduled_end, status, meeting_type, location, quorum_data")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const rows = (data ?? []) as MeetingForConvocatoria[];
  return rows.find((meeting) => {
    const links = extractMeetingSourceLinks(meeting.quorum_data);
    return links.convocatoria_id === convocatoriaId || (links.convocatoria_ids ?? []).includes(convocatoriaId);
  }) ?? findMeetingByBodyAndDate(rows, convocatoria) ?? null;
}

function findMeetingByBodyAndDate(
  rows: MeetingForConvocatoria[],
  convocatoria?: ConvocatoriaForMeetingSchedule | null,
) {
  const date = dateOnly(convocatoria?.fecha_1);
  if (!convocatoria?.body_id || !date) return null;
  return rows.find((meeting) => meeting.body_id === convocatoria.body_id && dateOnly(meeting.scheduled_start) === date) ?? null;
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

      const date = dateOnly(convocatoria.fecha_1);
      if (!date) return linked;
      const { data, error } = await supabase
        .from("meetings")
        .select("id, slug, body_id, scheduled_start, scheduled_end, status, meeting_type, location, quorum_data")
        .eq("tenant_id", tenantId)
        .eq("body_id", convocatoria.body_id)
        .gte("scheduled_start", `${date}T00:00:00.000Z`)
        .lt("scheduled_start", nextDateIso(date))
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? []) as MeetingForConvocatoria[])[0] ?? null;
    },
    staleTime: 20_000,
  });
}

/**
 * Materializa o reconcilia `agenda_items` rows desde los puntos de la convocatoria.
 *
 * Comportamiento (Codex P2 round 10 — UPDATE + INSERT, no solo gaps):
 *   - Rows faltantes (order_number ausente) → INSERT.
 *   - Rows existentes con kind=DELIBERATIVO (default conservador) Y la
 *     convocatoria declara un kind distinto → UPDATE para reconciliar.
 *     Solo se updatea cuando el row NO tiene historial en
 *     `agenda_item_kind_changelog` (es decir, el kind actual es el default
 *     legacy del flujo previo, no una reclasificación humana explícita).
 *   - Rows con changelog se respetan: una reclasificación humana es SSOT.
 *
 * Idempotente. Se ejecuta tanto en NEW meetings como en reused.
 */
async function materializeAgendaItemsForConvocatoriaMeeting(
  meetingId: string,
  tenantId: string,
  convocatoria: ConvocatoriaForMeetingSchedule,
): Promise<void> {
  const agendaPoints = convocatoria.agenda_items ?? [];
  if (agendaPoints.length === 0) return;
  // 1. SELECT existing rows con id+order_number+kind para reconciliar
  const { data: existingRows, error: selErr } = await supabase
    .from("agenda_items")
    .select("id, order_number, kind")
    .eq("meeting_id", meetingId)
    .eq("tenant_id", tenantId);
  if (selErr) {
    // Codex P2 round 15: abortar en lugar de loguear. Si el lookup falla
    // (RLS drift, transient PostgREST), no podemos garantizar idempotencia
    // y el usuario llegaría a voting con BD posiblemente inconsistente.
    // Mejor fallar temprano con mensaje claro.
    throw new Error(
      `Lookup de agenda_items existentes falló: ${selErr.message}. No se puede garantizar la materialización idempotente; reintenta la operación.`,
    );
  }
  const existingByOrder = new Map<number, { id: string; kind: string | null }>();
  for (const row of (existingRows ?? []) as Array<{
    id: string;
    order_number: number | null;
    kind: string | null;
  }>) {
    if (typeof row.order_number === "number") {
      existingByOrder.set(row.order_number, { id: row.id, kind: row.kind });
    }
  }

  // 2. Determinar inserts (gaps) y updates (legacy default ≠ convocatoria)
  const rowsToInsert: Array<{
    tenant_id: string;
    meeting_id: string;
    order_number: number;
    title: string;
    kind: string;
    decision_subtype: string | null;
  }> = [];
  const updateCandidates: Array<{
    id: string;
    desired_kind: string;
    desired_decision_subtype: string | null;
  }> = [];

  agendaPoints.forEach((point, index) => {
    const orderNumber = index + 1;
    const existing = existingByOrder.get(orderNumber);
    const desiredKind = point.kind ?? "DELIBERATIVO";
    const desiredSubtype = point.decision_subtype ?? null;
    if (!existing) {
      rowsToInsert.push({
        tenant_id: tenantId,
        meeting_id: meetingId,
        order_number: orderNumber,
        title: (point.titulo ?? "").trim().slice(0, 240) || `Punto ${orderNumber}`,
        kind: desiredKind,
        decision_subtype: desiredSubtype,
      });
      return;
    }
    // Existing row: reconciliar SOLO si current kind es legacy default
    // (DELIBERATIVO) y la convocatoria declara algo distinto.
    if (existing.kind === "DELIBERATIVO" && desiredKind !== "DELIBERATIVO") {
      updateCandidates.push({
        id: existing.id,
        desired_kind: desiredKind,
        desired_decision_subtype: desiredSubtype,
      });
    }
  });

  // 3. INSERT gaps
  if (rowsToInsert.length > 0) {
    const { error: insErr } = await supabase.from("agenda_items").insert(rowsToInsert);
    if (insErr) {
      // Codex P2 round 14: abortar en lugar de solo loguear. agenda_items
      // ya es requerido por triggers (T5, integrity rules) — sin esos rows
      // el usuario llega a voting/save con BD inconsistente y un error
      // críptico aguas abajo. Mejor fallar temprano con mensaje claro.
      throw new Error(
        `Materialización de agenda_items falló: ${insErr.message}. La reunión existe pero la agenda no se persistió; reintenta la creación o contacta soporte.`,
      );
    }
  }

  // 4. UPDATE candidatos legacy → solo si NO tienen changelog (respeta
  //    reclasificaciones humanas previas como SSOT).
  if (updateCandidates.length > 0) {
    const candidateIds = updateCandidates.map((c) => c.id);
    const { data: changelogRows, error: changelogErr } = await supabase
      .from("agenda_item_kind_changelog")
      .select("agenda_item_id")
      .in("agenda_item_id", candidateIds);
    if (changelogErr) {
      throw new Error(
        `No se pudo comprobar el historial de reclasificación de agenda_items: ${changelogErr.message}.`,
      );
    }
    const idsWithChangelog = new Set(
      ((changelogRows ?? []) as Array<{ agenda_item_id: string }>).map((r) => r.agenda_item_id),
    );
    for (const candidate of updateCandidates) {
      if (idsWithChangelog.has(candidate.id)) continue; // respeta humano
      const { error: updErr } = await supabase
        .from("agenda_items")
        .update({
          kind: candidate.desired_kind,
          decision_subtype: candidate.desired_decision_subtype,
        })
        .eq("id", candidate.id);
      if (updErr) {
        throw new Error(
          `Reconciliación de agenda_item ${candidate.id} falló: ${updErr.message}. La reunión no queda preparada para votación.`,
        );
      }
    }
  }
}

export function useCreateMeetingFromConvocatoria() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (convocatoria: ConvocatoriaForMeetingSchedule): Promise<{ id: string; reused: boolean }> => {
      if (!tenantId) throw new Error("Tenant no disponible");

      const existing = await findMeetingForConvocatoria(tenantId, convocatoria.id, convocatoria);
      if (existing) {
        // Codex P1 round 9: materializar agenda_items también para meetings
        // reused. Meetings creados por flujos previos (o emparejados manualmente
        // por body/date) podrían no tener rows agenda_items aún; idempotencia
        // garantiza que solo insertamos los faltantes.
        await materializeAgendaItemsForConvocatoriaMeeting(existing.id, tenantId, convocatoria);
        return { id: existing.id, reused: true };
      }

      const payload = buildMeetingScheduleFromConvocatoria(convocatoria);
      const { data, error } = await supabase
        .from("meetings")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      const meetingId = (data as { id: string }).id;

      // Codex P1 round 8: materializar agenda_items rows desde el INSERT inicial.
      await materializeAgendaItemsForConvocatoriaMeeting(meetingId, tenantId, convocatoria);

      return { id: meetingId, reused: false };
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
          "*, governing_bodies(name, body_type, entity_id, quorum_rule, entities(common_name, jurisdiction, legal_form, tipo_social, es_cotizada))",
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
          .select("id, order_number, title, description, kind, decision_subtype")
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
            .select("id, agreement_kind, matter_class, proposal_text, status, compliance_snapshot, compliance_explain")
            .eq("tenant_id", tenantId!)
            .eq("parent_meeting_id", meetingId!)
            .in("status", ["DRAFT", "PROPOSED"]);
          if (byMeetingError) return { data: null, error: byMeetingError };

          if (explicitAgreementIds.length === 0) {
            return { data: byMeeting ?? [], error: null };
          }

          const { data: byExplicitIds, error: byIdsError } = await supabase
            .from("agreements")
            .select("id, agreement_kind, matter_class, proposal_text, status, compliance_snapshot, compliance_explain")
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
      return ((data ?? []) as Raw[]).map((r) => ({
        id: r.id,
        person_id: r.person_id,
        tipo_condicion: r.tipo_condicion,
        full_name: r.person?.full_name ?? "Sin nombre",
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
        .update({ status: "CELEBRADA" })
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
  return useMutation({
    mutationFn: async ({
      meetingId,
      content,
      canonicalMinutesHash,
      entityId,
      bodyId,
      sessionKind = "MEETING",
      snapshotType,
    }: {
      meetingId: string;
      content: string;
      canonicalMinutesHash?: string | null;
      entityId: string;
      bodyId: string;
      sessionKind?: "MEETING" | "NO_SESSION" | "UNIPERSONAL";
      snapshotType: "ECONOMICO" | "POLITICO" | "UNIVERSAL";
    }) => {
      const { data: snapshotId, error: snapshotError } = await supabase.rpc(
        "fn_crear_censo_snapshot",
        {
          p_meeting_id: meetingId,
          p_session_kind: sessionKind,
          p_entity_id: entityId,
          p_body_id: bodyId,
          p_snapshot_type: snapshotType,
        },
      );
      if (snapshotError) throw snapshotError;
      if (!snapshotId) throw new Error("No se pudo crear el snapshot WORM de censo para el acta.");

      const { data, error } = await supabase.rpc("fn_generar_acta", {
        p_meeting_id: meetingId,
        p_content: content,
        p_snapshot_id: snapshotId,
        p_canonical_minutes_hash: canonicalMinutesHash ?? null,
      });
      if (error) throw error;
      return data as string;
    },
  });
}
