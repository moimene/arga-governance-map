import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildCertificationPlan,
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
  normalizeAgendaItemKind,
  type AgendaItemKind,
  type ResolutionKind,
} from "@/lib/secretaria/agenda-kind";

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
// D3 — Construcción de puntos del acta en ORDEN SECUENCIAL (RRM art. 99).
// =============================================================================
//
// CRÍTICO D3: NO reagrupar por kind. RRM art. 99 exige relación cronológica
// del acta. La plantilla ACTA_SESION canónica usa {{#each meetings.junta.puntos}}
// como loop secuencial. Reagrupación rompe orden + plantilla + jurisprudencia.
// Ver docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md §10 + adversarial round 4.
//
// La plantilla v1.3.0 (pendiente de bump por Comité Legal) podrá usar bloques
// condicionales `{{#if (eq kind "DECISORIO")}}…{{/if}}` para renderizar campos
// decisorios solo en puntos DECISORIO. Mientras la plantilla actual (legacy
// v1.2.0) renderice todos los campos genéricamente, los campos decisorios
// (kind_resolution, status, resolution_text) quedan vacíos en puntos no-DEC
// — degradación elegante.

/**
 * Punto del acta listo para el loop de la plantilla canónica.
 *
 * Incluye:
 *  - `order_number`: posición cronológica en el orden del día (1..N).
 *  - `kind`: naturaleza del punto (INFORMATIVO/DELIBERATIVO/DECISORIO).
 *  - `kind_resolution`: tipo de resolución registrada (sólo si hubo voto).
 *  - `status` + `resolution_text`: resultado de la votación (sólo DECISORIO).
 */
export interface ActaPuntoSequencial {
  id: string;
  meeting_id: string;
  order_number: number;
  title: string;
  description: string | null;
  kind: AgendaItemKind;
  kind_resolution: ResolutionKind | null;
  status: string | null;
  resolution_text: string | null;
  agreement_id: string | null;
}

/** Fila mínima esperada desde `agenda_items` (vía PostgREST). */
export interface AgendaItemRow {
  id: string;
  meeting_id: string;
  order_number: number;
  title: string;
  description: string | null;
  kind?: string | null;
  tenant_id: string;
  created_at?: string | null;
}

/** Fila mínima esperada desde `meeting_resolutions` (vía PostgREST). */
export interface MeetingResolutionRow {
  meeting_id: string;
  agenda_item_index: number | null;
  kind_resolution?: string | null;
  status?: string | null;
  resolution_text?: string | null;
  agreement_id?: string | null;
}

const VALID_RESOLUTION_KINDS = new Set<ResolutionKind>([
  "DECISION",
  "DELIBERATION_OUTCOME",
  "INFORMATION_NOTED",
]);

function normalizeResolutionKind(value: unknown): ResolutionKind | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase().trim();
  return VALID_RESOLUTION_KINDS.has(upper as ResolutionKind)
    ? (upper as ResolutionKind)
    : null;
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
  // CRÍTICO D3: ordenamos por order_number ASC. NO por kind.
  // Cualquier reagrupación rompería la plantilla {{#each puntos}} + RRM art. 99.
  const sorted = [...agendaItems].sort((a, b) => a.order_number - b.order_number);

  // Indexamos resoluciones por agenda_item_index para lookup O(1).
  const byIndex = new Map<number, MeetingResolutionRow>();
  for (const res of resolutions) {
    if (typeof res.agenda_item_index === "number") {
      byIndex.set(res.agenda_item_index, res);
    }
  }

  return sorted.map((item) => {
    const resolution = byIndex.get(item.order_number) ?? null;
    return {
      id: item.id,
      meeting_id: item.meeting_id,
      order_number: item.order_number,
      title: item.title,
      description: item.description,
      kind: normalizeAgendaItemKind(item.kind ?? "DELIBERATIVO"),
      kind_resolution: resolution ? normalizeResolutionKind(resolution.kind_resolution) : null,
      status: resolution?.status ?? null,
      resolution_text: resolution?.resolution_text ?? null,
      agreement_id: resolution?.agreement_id ?? null,
    };
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
      const [itemsRes, resolutionsRes] = await Promise.all([
        supabase
          .from("agenda_items")
          .select("id, meeting_id, order_number, title, description, kind, tenant_id, created_at")
          .eq("meeting_id", meetingId!)
          .eq("tenant_id", tenantId!)
          .order("order_number", { ascending: true }),
        supabase
          .from("meeting_resolutions")
          .select("meeting_id, agenda_item_index, kind_resolution, status, resolution_text, agreement_id")
          .eq("meeting_id", meetingId!)
          .eq("tenant_id", tenantId!),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (resolutionsRes.error) throw resolutionsRes.error;

      const items = (itemsRes.data ?? []) as AgendaItemRow[];
      const resolutions = (resolutionsRes.data ?? []) as MeetingResolutionRow[];
      return buildActaPuntosSequencial(items, resolutions);
    },
  });
}
