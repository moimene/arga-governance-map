import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildCertificationPlan,
  extractPointSnapshots,
  type CertificationPlan,
  type CertificationResolutionRow,
} from "@/lib/secretaria/certification-snapshot";
import {
  buildMeetingAgreementPayload,
  extractAgendaItemIndexFromExecutionMode,
  type AgreementOrigin,
} from "@/lib/secretaria/agreement-360";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";
import {
  buildActaAgendaViewModel,
  computeCanonicalMinutesHash,
  validateActaLegalStructure,
  type ActaAgendaConstanciaRow,
  type ActaAgendaItemRow,
  type ActaAgendaItemViewModel,
  type ActaAgreementRow,
  type ActaLegalStructureValidationResult,
  type ActaMeetingResolutionRow,
} from "@/lib/secretaria/acta-agenda";

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
  /** F8.1: las minutes ahora llevan body_id/entity_id denormalizados. */
  body_id: string | null;
  entity_id: string | null;
  meeting_type: string | null;
  body_name: string | null;
  entity_name: string | null;
  resolutions_count: number;
  canonical_minutes_hash?: string | null;
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
  evidence_id?: string | null;
  gate_hash?: string | null;
}

function requiredMajorityCodeForSnapshot(
  snapshot: MeetingAdoptionSnapshot,
  storedCode?: string | null,
) {
  if (storedCode?.startsWith(`${snapshot.materia}:`)) return storedCode;
  return `${snapshot.materia}:${snapshot.materia_clase}`;
}

export function useActasList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["actas", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<ActaRow[]> => {
      let query = supabase
        .from("minutes")
        .select(
          "*, meetings(meeting_type, governing_bodies(name, entities(common_name)))",
        )
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      const { data, error } = await query;
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
    scheduled_end?: string | null;
    location?: string | null;
    quorum_data?: Record<string, unknown> | null;
    president?: { full_name?: string | null } | null;
    secretary?: { full_name?: string | null } | null;
    governing_bodies?: {
      name?: string | null;
      body_type?: string | null;
      entities?: { common_name?: string | null; jurisdiction?: string | null } | null;
    } | null;
  } | null;
};

export function useActaById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["actas", tenantId, "byId", id],
    queryFn: async () => {
      // `*` incluye body_id/entity_id (añadidos en migración
      // 20260421_000024). Los necesita EmitirCertificacionButton.
      const { data, error } = await supabase
        .from("minutes")
        .select(
          "*, meetings(meeting_type, scheduled_start, scheduled_end, location, quorum_data, president:president_id(full_name), secretary:secretary_id(full_name), governing_bodies(name, body_type, entities(common_name, jurisdiction)))",
        )
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as ActaDetailRow | null;
    },
  });
}

export function useCertificationPlanForMinute(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!minuteId && !!tenantId,
    queryKey: ["certification_plan", tenantId, "forMinute", minuteId],
    queryFn: async (): Promise<CertificationPlan> => {
      const { data: minute, error: minuteError } = await supabase
        .from("minutes")
        .select("meeting_id")
        .eq("id", minuteId!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (minuteError) throw minuteError;
      if (!minute?.meeting_id) {
        return buildCertificationPlan({ meetingId: "no-meeting", quorumData: null, resolutions: [] });
      }

      const [meetingRes, resolutionsRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("quorum_data")
          .eq("id", minute.meeting_id)
          .eq("tenant_id", tenantId!)
          .maybeSingle(),
        supabase
          .from("meeting_resolutions")
          .select("id, agenda_item_index, agreement_id, resolution_text, status")
          .eq("meeting_id", minute.meeting_id)
          .eq("tenant_id", tenantId!)
          .order("agenda_item_index", { ascending: true }),
      ]);
      if (meetingRes.error) throw meetingRes.error;
      if (resolutionsRes.error) throw resolutionsRes.error;

      return buildCertificationPlan({
        meetingId: minute.meeting_id,
        quorumData: (meetingRes.data as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? null,
        resolutions: (resolutionsRes.data ?? []) as CertificationResolutionRow[],
      });
    },
  });
}

export function useCertificationsByMinute(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!minuteId && !!tenantId,
    queryKey: ["certifications", tenantId, "byMinute", minuteId],
    queryFn: async (): Promise<CertificationRow[]> => {
      const { data, error } = await supabase
        .from("certifications")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("minute_id", minuteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CertificationRow[];
    },
  });
}

export interface AprobarActaResult {
  minute_id: string;
  signed_at: string;
  already_signed: boolean;
}

/**
 * Aprueba y firma el acta (minutes.signed_at) y la bloquea (is_locked) vía
 * fn_aprobar_acta. Es el paso que desbloquea el gate de certificación de
 * ActaDetalle (RRM arts. 108-109): sin él, ningún acta generada por el flujo
 * operativo podía emitir certificación (ITEM-003 del loop de estabilización).
 */
export function useAprobarActa(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!minuteId) throw new Error("Acta no disponible.");
      const { data, error } = await supabase.rpc("fn_aprobar_acta", {
        p_minute_id: minuteId,
      });
      if (error) throw error;
      return data as AprobarActaResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actas", tenantId] });
    },
  });
}

export interface UpdateActaBorradorResult {
  minute_id: string;
  content_hash: string;
  updated: boolean;
}

/**
 * W0 — guarda la edición del contenido de un acta en BORRADOR vía
 * `fn_actualizar_borrador_acta`. La RPC recalcula `content_hash` con el mismo
 * algoritmo que `fn_generar_acta` y rechaza el acta firmada/bloqueada. Cierra la
 * incidencia de la primera pasada de test: hasta ahora no existía ningún camino
 * para editar y persistir el texto del acta (ActaDetalle era read-only).
 */
export function useUpdateActaBorrador(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string): Promise<UpdateActaBorradorResult> => {
      if (!minuteId) throw new Error("Acta no disponible.");
      const { data, error } = await supabase.rpc("fn_actualizar_borrador_acta", {
        p_minute_id: minuteId,
        p_content: content,
      });
      if (error) throw error;
      return data as UpdateActaBorradorResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actas", tenantId] });
    },
  });
}

export interface MaterializeMeetingPointAgreementInput {
  meetingId: string;
  bodyId: string | null;
  entityId: string | null;
  scheduledStart?: string | null;
  snapshot: MeetingAdoptionSnapshot;
  origin?: AgreementOrigin;
}

export function useMaterializeMeetingPointAgreement(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MaterializeMeetingPointAgreementInput) => {
      if (!tenantId) throw new Error("Tenant activo no disponible.");
      if (!input.entityId || !input.bodyId) {
        throw new Error("No se puede materializar el acuerdo: falta entidad u órgano.");
      }

      const agendaItemIndex = input.snapshot.agenda_item_index;
      const { data: agendaItem, error: agendaItemError } = await supabase
        .from("agenda_items")
        .select("id, kind")
        .eq("tenant_id", tenantId)
        .eq("meeting_id", input.meetingId)
        .eq("order_number", agendaItemIndex)
        .maybeSingle();
      if (agendaItemError) throw agendaItemError;
      const agendaItemRow = agendaItem as { id?: string | null; kind?: string | null } | null;
      if (!agendaItemRow?.id) {
        throw new Error("No existe el punto del orden del día que debe anclar el acuerdo.");
      }
      if (agendaItemRow.kind !== "DECISORIO") {
        throw new Error("Solo un punto decisorio puede materializarse como Acuerdo 360.");
      }

      const { data: resolutionRows, error: resolutionError } = await supabase
        .from("meeting_resolutions")
        .select("id, agenda_item_index, agreement_id, resolution_text, required_majority_code, status")
        .eq("tenant_id", tenantId)
        .eq("meeting_id", input.meetingId)
        .eq("agenda_item_index", agendaItemIndex)
        .limit(1);
      if (resolutionError) throw resolutionError;
      const resolution = (resolutionRows ?? [])[0] as
        | {
            id: string;
            agreement_id: string | null;
            resolution_text: string | null;
            required_majority_code: string | null;
          }
        | undefined;

      if (!resolution) {
        throw new Error("No existe la resolución persistida del punto. Registre primero la votación de la reunión.");
      }
      if (resolution.agreement_id) {
        return {
          agreementId: resolution.agreement_id,
          agendaItemIndex,
          created: false,
          linkedExistingResolution: true,
        };
      }

      const { data: existingAgreements, error: existingAgreementsError } = await supabase
        .from("agreements")
        .select("id, execution_mode")
        .eq("tenant_id", tenantId)
        .eq("parent_meeting_id", input.meetingId);
      if (existingAgreementsError) throw existingAgreementsError;

      const existingAgreementId = ((existingAgreements ?? []) as Array<{ id: string; execution_mode?: unknown }>)
        .find((agreement) => extractAgendaItemIndexFromExecutionMode(agreement.execution_mode) === agendaItemIndex)
        ?.id ?? null;

      const payload = buildMeetingAgreementPayload({
        tenantId,
        entityId: input.entityId,
        bodyId: input.bodyId,
        meetingId: input.meetingId,
        scheduledStart: input.scheduledStart,
        snapshot: input.snapshot,
        resolutionText: resolution.resolution_text,
        requiredMajorityCode: requiredMajorityCodeForSnapshot(input.snapshot, resolution.required_majority_code),
        origin: input.origin ?? "MEETING_FLOOR",
        agendaItemId: agendaItemRow.id,
      });
      if (!payload) {
        throw new Error("El punto no es societariamente proclamable y no puede materializarse como Acuerdo 360.");
      }

      let agreementId = existingAgreementId;
      if (agreementId) {
        const { error: updateError } = await supabase
          .from("agreements")
          .update(payload)
          .eq("tenant_id", tenantId)
          .eq("id", agreementId);
        if (updateError) throw updateError;
      } else {
        const { data: insertedAgreement, error: insertError } = await supabase
          .from("agreements")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        agreementId = (insertedAgreement as { id: string }).id;
      }

      const { error: linkError } = await supabase
        .from("meeting_resolutions")
        .update({
          agreement_id: agreementId,
          status: "ADOPTED",
          resolution_text: input.snapshot.resolution_text,
          required_majority_code: requiredMajorityCodeForSnapshot(input.snapshot, resolution.required_majority_code),
        })
        .eq("tenant_id", tenantId)
        .eq("id", resolution.id);
      if (linkError) throw linkError;

      return {
        agreementId,
        agendaItemIndex,
        created: !existingAgreementId,
        linkedExistingResolution: false,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certification_plan", tenantId, "forMinute", minuteId] });
      queryClient.invalidateQueries({ queryKey: ["actas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["agreements", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["certification_registry_intake", tenantId] });
    },
  });
}

// =============================================================================
// P0 — Acta cronológica agenda-driven.
// =============================================================================
//
// El acta se construye desde `agenda_items ORDER BY order_number`, no desde
// `agreements`. Un `agreement` es únicamente el resultado posible de un punto
// DECISORIO. Puntos informativos, tomas de razón, deliberativos, aceptación de
// informe y ruegos/preguntas se documentan como constancia.

export type ActaPuntoSequencial = ActaAgendaItemViewModel;
export type AgendaItemRow = ActaAgendaItemRow;
export type MeetingResolutionRow = ActaMeetingResolutionRow;

export interface ActaAgendaContract {
  puntos: ActaAgendaItemViewModel[];
  validation: ActaLegalStructureValidationResult;
  canonicalMinutesHash: string;
  agreementRows: ActaAgreementRow[];
}

/**
 * Construye el array de puntos del acta preservando el orden cronológico
 * exigido por RRM art. 99. NUNCA reagrupa por `kind`.
 *
 * Reglas:
 *  1. Ordena por `order_number` ASC (estable, no por kind).
 *  2. Para cada punto, busca su resolución por `agenda_item_index === order_number`.
 *  3. Si hay resolución → enriquece con `kind_resolution`, `status`,
 *     `resolution_text`, `agreement_id`. Si no → campos null (degradación elegante).
 *  4. `kind` normalizado via `normalizeAgendaItemKind` (default DELIBERATIVO).
 *
 * Función PURA: sin efectos secundarios, sin Supabase, sin Tanstack.
 * Reutilizable por tests, plantillas y previsualización de acta.
 */
export function buildActaPuntosSequencial(
  agendaItems: AgendaItemRow[],
  resolutions: MeetingResolutionRow[],
): ActaPuntoSequencial[] {
  return buildActaAgendaViewModel({ agendaItems, resolutions });
}

async function loadActaAgendaContract(params: {
  tenantId: string;
  meetingId: string;
}): Promise<ActaAgendaContract> {
  const [itemsRes, resolutionsRes, constanciasRes, meetingRes, agreementsRes] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("id, meeting_id, order_number, title, description, kind, requires_vote, requires_attachments, tenant_id, created_at")
      .eq("meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId)
      .order("order_number", { ascending: true }),
    supabase
      .from("meeting_resolutions")
      .select("id, meeting_id, agenda_item_index, kind_resolution, status, resolution_text, agreement_id, required_majority_code")
      .eq("meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId),
    supabase
      .from("agenda_item_constancias")
      .select("id, agenda_item_id, meeting_id, kind, summary, participants, follow_ups, attachments")
      .eq("meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId),
    supabase
      .from("meetings")
      .select("quorum_data")
      .eq("id", params.meetingId)
      .eq("tenant_id", params.tenantId)
      .maybeSingle(),
    supabase
      .from("agreements")
      .select("id, parent_meeting_id, agenda_item_id, status")
      .eq("parent_meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (resolutionsRes.error) throw resolutionsRes.error;
  if (constanciasRes.error) throw constanciasRes.error;
  if (meetingRes.error) throw meetingRes.error;
  if (agreementsRes.error) throw agreementsRes.error;

  const agendaItems = (itemsRes.data ?? []) as ActaAgendaItemRow[];
  const resolutions = (resolutionsRes.data ?? []) as ActaMeetingResolutionRow[];
  const constancias = (constanciasRes.data ?? []) as ActaAgendaConstanciaRow[];
  const agreementRows = (agreementsRes.data ?? []) as ActaAgreementRow[];
  const snapshots = extractPointSnapshots(
    (meetingRes.data as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? null,
  );
  const puntos = buildActaAgendaViewModel({
    agendaItems,
    resolutions,
    constancias,
    snapshots,
  });
  const validation = validateActaLegalStructure({
    meetingId: params.meetingId,
    puntos,
    agendaItems,
    agreementRows,
    renderedOrderNumbers: puntos.map((point) => point.order_number),
  });
  const canonicalMinutesHash = await computeCanonicalMinutesHash({
    meetingId: params.meetingId,
    puntos,
  });

  return { puntos, validation, canonicalMinutesHash, agreementRows };
}

export function useActaAgendaContract(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["actas", tenantId, "agenda_contract", meetingId],
    queryFn: () => loadActaAgendaContract({ tenantId: tenantId!, meetingId: meetingId! }),
  });
}

/**
 * Hook derivado: carga `agenda_items` + `meeting_resolutions` para un
 * meeting y devuelve los puntos en ORDEN SECUENCIAL para el loop de la
 * plantilla ACTA_SESION.
 *
 * Wrapper read-only sobre `buildActaPuntosSequencial` con tenant scoping
 * y queryKey estable.
 */
export function useActaPuntosSequencial(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["actas", tenantId, "puntos_sequencial", meetingId],
    queryFn: async (): Promise<ActaPuntoSequencial[]> => {
      const contract = await loadActaAgendaContract({ tenantId: tenantId!, meetingId: meetingId! });
      return contract.puntos;
    },
  });
}
