import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";
import {
  compactAgreementNormativeSnapshot,
  type AgreementNormativeSnapshot,
} from "@/lib/secretaria/normative-framework";

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
  normativeSnapshot?: AgreementNormativeSnapshot | null;
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

function normalizeRequiredMajorityCode(input: MeetingAgreementMaterializationInput) {
  const stored = input.requiredMajorityCode?.trim();
  if (stored && !stored.includes(":")) return stored;
  if (input.snapshot.materia_clase === "ORDINARIA") return "SIMPLE";
  if (input.snapshot.materia_clase === "ESTRUCTURAL") return "ESTRUCTURAL";
  return "REFORZADA";
}

export function isInscribableAgreementMatter(materia: string, matterClass: string) {
  return INSCRIBABLE_MATTERS.has(materia) || matterClass === "ESTRUCTURAL";
}

function compactNormativeSnapshotForMeeting(input: MeetingAgreementMaterializationInput) {
  const provided = compactAgreementNormativeSnapshot(input.normativeSnapshot);
  if (provided) return provided;

  const trace = input.snapshot.rule_trace;
  const inscribable = isInscribableAgreementMatter(input.snapshot.materia, input.snapshot.materia_clase);
  return {
    schema_version: "agreement-normative-snapshot.v1",
    snapshot_id:
      trace?.ruleset_snapshot_id ??
      `meeting-adoption:${input.meetingId}:${input.snapshot.agenda_item_index}:${input.snapshot.evaluated_at}`,
    profile_id:
      `agreement-360:${input.entityId}:${input.snapshot.voting_context.tipo_social}:${input.snapshot.voting_context.organo_tipo}`,
    profile_hash: trace?.payload_hash ?? trace?.ruleset_snapshot_id ?? input.snapshot.evaluated_at,
    profile_version: trace?.rule_pack_version ?? "meeting-adoption-snapshot.v2",
    framework_status: input.snapshot.societary_validity.ok ? "COMPLETO" : "CONFLICTO",
    entity_id: input.entityId,
    agreement_id: null,
    agreement_kind: input.snapshot.materia,
    matter_class: input.snapshot.materia_clase,
    adoption_mode: input.snapshot.voting_context.adoption_mode,
    evaluated_at: input.snapshot.evaluated_at,
    source_layers: ["LEY", "ESTATUTOS", "PACTO_PARASOCIAL", "SISTEMA"],
    formalization: inscribable
      ? ["CERTIFICACION", "LIBRO_ACTAS", "ESCRITURA_PUBLICA", "INSCRIPCION_REGISTRAL", "EVIDENCIA_QTSP"]
      : ["CERTIFICACION", "LIBRO_ACTAS", "EVIDENCIA_QTSP"],
    warnings: [
      ...(input.snapshot.societary_validity.warnings ?? []),
      ...(input.snapshot.pacto_compliance.warnings ?? []),
      ...(trace?.warnings ?? []),
    ],
    blockers: [
      ...(input.snapshot.societary_validity.blocking_issues ?? []),
      ...(input.snapshot.pacto_compliance.blocking_issues ?? []),
    ],
    rule_trace: {
      jurisdiction_rule_set_ids: trace?.ruleset_snapshot_id ? [trace.ruleset_snapshot_id] : [],
      rule_pack_version_ids: trace?.rule_pack_version_id ? [trace.rule_pack_version_id] : [],
      override_ids: [],
      pacto_ids: [],
      meeting_rule_pack_id: trace?.rule_pack_id ?? null,
      meeting_rule_pack_version: trace?.rule_pack_version ?? null,
      meeting_ruleset_snapshot_id: trace?.ruleset_snapshot_id ?? null,
      meeting_payload_hash: trace?.payload_hash ?? null,
    },
  };
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
  const requiredMajorityCode = normalizeRequiredMajorityCode(input);
  const normativeSnapshot = compactNormativeSnapshotForMeeting(input);
  const complianceSnapshot = normativeSnapshot
    ? {
        ...input.snapshot,
        normative_profile: normativeSnapshot,
        normative_snapshot_id: normativeSnapshot.snapshot_id,
        normative_profile_id: normativeSnapshot.profile_id,
        normative_profile_hash: normativeSnapshot.profile_hash,
        normative_framework_status: normativeSnapshot.framework_status,
      }
    : input.snapshot;

  const agreement360 = {
    version: AGREEMENT_360_VERSION,
    origin,
    source: "meeting_resolutions",
    meeting_id: input.meetingId,
    agenda_item_index: input.snapshot.agenda_item_index,
    materialized_at: now,
    materialized: true,
    normative_snapshot_id: normativeSnapshot?.snapshot_id ?? null,
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
    compliance_snapshot: complianceSnapshot,
    compliance_explain: {
      agreement_360: agreement360,
      societary_validity: input.snapshot.societary_validity,
      pacto_compliance: input.snapshot.pacto_compliance,
      normative_snapshot: normativeSnapshot,
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
  const normativeSnapshot = compactNormativeSnapshotForMeeting(input);
  const agreement360 = {
    version: AGREEMENT_360_VERSION,
    origin: input.origin ?? "MEETING_FLOOR",
    source: "meeting_resolutions",
    meeting_id: input.meetingId,
    agenda_item_index: input.snapshot.agenda_item_index,
    materialized_at: now,
    materialized: false,
    reason,
    normative_snapshot_id: normativeSnapshot?.snapshot_id ?? null,
  };
  const complianceSnapshot = normativeSnapshot
    ? {
        ...input.snapshot,
        normative_profile: normativeSnapshot,
        normative_snapshot_id: normativeSnapshot.snapshot_id,
        normative_profile_id: normativeSnapshot.profile_id,
        normative_profile_hash: normativeSnapshot.profile_hash,
        normative_framework_status: normativeSnapshot.framework_status,
      }
    : input.snapshot;

  return {
    agreement_kind: input.snapshot.materia,
    matter_class: input.snapshot.materia_clase,
    status: "DRAFT",
    decision_text: null,
    decision_date: null,
    proposal_text: textForAgreement(input),
    required_majority_code: normalizeRequiredMajorityCode(input),
    compliance_snapshot: complianceSnapshot,
    compliance_explain: {
      agreement_360: agreement360,
      societary_validity: input.snapshot.societary_validity,
      pacto_compliance: input.snapshot.pacto_compliance,
      normative_snapshot: normativeSnapshot,
    },
    execution_mode: {
      mode: "MEETING",
      ...agreement360,
      agreement_360: agreement360,
    },
    updated_at: now,
  };
}
