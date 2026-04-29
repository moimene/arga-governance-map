import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

export type AgreementOrigin =
  | "PREPARED"
  | "AGENDA_ITEM"
  | "MEETING_FLOOR"
  | "NO_SESSION"
  | "UNIPERSONAL"
  | "GROUP_CAMPAIGN";

export interface MeetingAgreementMaterializationInput {
  tenantId: string;
  entityId: string;
  bodyId: string;
  meetingId: string;
  scheduledStart?: string | null;
  snapshot: MeetingAdoptionSnapshot;
  resolutionText?: string | null;
  requiredMajorityCode?: string | null;
  origin?: AgreementOrigin;
  materializedAt?: string;
}

export interface MeetingAgreementResetInput extends MeetingAgreementMaterializationInput {
  reason?: string;
}

export interface ExistingAgreement360 {
  id: string;
  execution_mode?: unknown;
}

export type Agreement360Payload = Record<string, unknown>;

const AGREEMENT_360_VERSION = "agreement-360.v1";

const INSCRIBABLE_MATTERS = new Set([
  "NOMBRAMIENTO_CONSEJERO",
  "CESE_CONSEJERO",
  "DELEGACION_FACULTADES",
  "NOMBRAMIENTO_AUDITOR",
  "MODIFICACION_ESTATUTOS",
  "AUMENTO_CAPITAL",
  "REDUCCION_CAPITAL",
  "FUSION",
  "ESCISION",
  "DISOLUCION",
  "LIQUIDACION",
  "TRANSFORMACION",
  "EMISION_OBLIGACIONES",
  "AMPLIACION_OBJETO_SOCIAL",
  "CAMBIO_DOMICILIO_SOCIAL",
  "CAMBIO_DENOMINACION_SOCIAL",
  "PRORROGA_SOCIEDAD",
  "EMISION_DEUDA_CONVERTIBLE",
  "DELEGACION_CAPITAL",
]);

function dateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function textForAgreement(input: MeetingAgreementMaterializationInput) {
  return input.resolutionText?.trim() || input.snapshot.resolution_text || input.snapshot.materia;
}

export function isInscribableAgreementMatter(materia: string, matterClass: string) {
  return INSCRIBABLE_MATTERS.has(materia) || matterClass === "ESTRUCTURAL";
}

export function isMaterializableMeetingAgreement(snapshot: MeetingAdoptionSnapshot | null | undefined) {
  return (
    snapshot?.status_resolucion === "ADOPTED" &&
    snapshot.societary_validity.ok &&
    snapshot.societary_validity.agreement_proclaimable
  );
}

export function extractAgendaItemIndexFromExecutionMode(executionMode: unknown) {
  if (!executionMode || typeof executionMode !== "object" || Array.isArray(executionMode)) return null;
  const record = executionMode as Record<string, unknown>;
  const direct = record.agenda_item_index;
  const agreement360 = record.agreement_360;
  const nested =
    agreement360 && typeof agreement360 === "object" && !Array.isArray(agreement360)
      ? (agreement360 as Record<string, unknown>).agenda_item_index
      : null;
  const raw = direct ?? nested;
  return typeof raw === "number" && Number.isInteger(raw) ? raw : null;
}

export function buildMeetingAgreementPayload(input: MeetingAgreementMaterializationInput): Agreement360Payload | null {
  if (!isMaterializableMeetingAgreement(input.snapshot)) return null;

  const now = input.materializedAt ?? new Date().toISOString();
  const origin = input.origin ?? "MEETING_FLOOR";
  const resolutionText = textForAgreement(input);
  const decisionDate = dateOnly(input.scheduledStart) ?? dateOnly(input.snapshot.evaluated_at) ?? dateOnly(now);
  const requiredMajorityCode =
    input.requiredMajorityCode ?? `${input.snapshot.materia}:${input.snapshot.materia_clase}`;

  const agreement360 = {
    version: AGREEMENT_360_VERSION,
    origin,
    source: "meeting_resolutions",
    meeting_id: input.meetingId,
    agenda_item_index: input.snapshot.agenda_item_index,
    materialized_at: now,
    materialized: true,
  };

  return {
    tenant_id: input.tenantId,
    entity_id: input.entityId,
    body_id: input.bodyId,
    agreement_kind: input.snapshot.materia,
    matter_class: input.snapshot.materia_clase,
    inscribable: isInscribableAgreementMatter(input.snapshot.materia, input.snapshot.materia_clase),
    adoption_mode: "MEETING",
    status: "ADOPTED",
    parent_meeting_id: input.meetingId,
    proposal_text: resolutionText,
    decision_text: resolutionText,
    decision_date: decisionDate,
    required_majority_code: requiredMajorityCode,
    compliance_snapshot: input.snapshot,
    compliance_explain: {
      agreement_360: agreement360,
      societary_validity: input.snapshot.societary_validity,
      pacto_compliance: input.snapshot.pacto_compliance,
    },
    execution_mode: {
      mode: "MEETING",
      ...agreement360,
      agreement_360: agreement360,
    },
    updated_at: now,
  };
}

export function buildMeetingAgreementDraftResetPayload(input: MeetingAgreementResetInput): Agreement360Payload {
  const now = input.materializedAt ?? new Date().toISOString();
  const reason =
    input.reason ??
    (input.snapshot.status_resolucion !== "ADOPTED"
      ? "resolution_not_adopted"
      : "societary_validity_not_proclaimable");
  const agreement360 = {
    version: AGREEMENT_360_VERSION,
    origin: input.origin ?? "MEETING_FLOOR",
    source: "meeting_resolutions",
    meeting_id: input.meetingId,
    agenda_item_index: input.snapshot.agenda_item_index,
    materialized_at: now,
    materialized: false,
    reason,
  };

  return {
    agreement_kind: input.snapshot.materia,
    matter_class: input.snapshot.materia_clase,
    status: "DRAFT",
    decision_text: null,
    decision_date: null,
    proposal_text: textForAgreement(input),
    required_majority_code:
      input.requiredMajorityCode ?? `${input.snapshot.materia}:${input.snapshot.materia_clase}`,
    compliance_snapshot: input.snapshot,
    compliance_explain: {
      agreement_360: agreement360,
      societary_validity: input.snapshot.societary_validity,
      pacto_compliance: input.snapshot.pacto_compliance,
    },
    execution_mode: {
      mode: "MEETING",
      ...agreement360,
      agreement_360: agreement360,
    },
    updated_at: now,
  };
}
