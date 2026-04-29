import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

export interface CertificationResolutionRow {
  id: string;
  agenda_item_index: number;
  agreement_id: string | null;
  resolution_text: string | null;
  status: string | null;
}

export interface CertificationReferenceDetail {
  ref: string;
  agenda_item_index: number;
  resolution_id: string | null;
  resolution_status: string | null;
  kind: "agreement_id" | "meeting_point";
  materializedAgreement: boolean;
}

export interface CertificationPlan {
  refs: string[];
  agreementRefs: string[];
  pointRefs: string[];
  referenceDetails: CertificationReferenceDetail[];
  hasPointSnapshots: boolean;
  certifiableSnapshots: MeetingAdoptionSnapshot[];
  blockedSnapshots: MeetingAdoptionSnapshot[];
  contractualWarnings: MeetingAdoptionSnapshot[];
  warnings: string[];
  requiresAgreementLink: boolean;
  evidenceReadiness: "FINAL_READY" | "CERTIFIABLE_WITH_POINT_REFS" | "BLOCKED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMeetingAdoptionSnapshot(value: unknown): value is MeetingAdoptionSnapshot {
  if (!isRecord(value)) return false;
  const status = value.status_resolucion;
  return (
    typeof value.agenda_item_index === "number" &&
    typeof value.resolution_text === "string" &&
    typeof value.materia === "string" &&
    (status === "ADOPTED" || status === "REJECTED") &&
    isRecord(value.vote_summary) &&
    isRecord(value.societary_validity) &&
    Array.isArray(value.societary_validity.blocking_issues) &&
    Array.isArray(value.societary_validity.warnings) &&
    isRecord(value.pacto_compliance) &&
    Array.isArray(value.pacto_compliance.blocking_issues) &&
    Array.isArray(value.pacto_compliance.warnings)
  );
}

export function extractPointSnapshots(quorumData: Record<string, unknown> | null | undefined): MeetingAdoptionSnapshot[] {
  const raw = quorumData?.point_snapshots;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isMeetingAdoptionSnapshot);
}

export function buildCertificationPlan(params: {
  meetingId: string;
  quorumData?: Record<string, unknown> | null;
  resolutions: CertificationResolutionRow[];
}): CertificationPlan {
  const snapshots = extractPointSnapshots(params.quorumData);
  const byIndex = new Map(
    params.resolutions.map((resolution) => [resolution.agenda_item_index, resolution])
  );

  if (snapshots.length === 0) {
    return {
      refs: [],
      agreementRefs: [],
      pointRefs: [],
      referenceDetails: [],
      hasPointSnapshots: false,
      certifiableSnapshots: [],
      blockedSnapshots: [],
      contractualWarnings: [],
      warnings: params.resolutions.length > 0
        ? ["missing_point_snapshots"]
        : ["no_resolutions_to_certify"],
      requiresAgreementLink: false,
      evidenceReadiness: "BLOCKED",
    };
  }

  const certifiableSnapshots = snapshots.filter(
    (snapshot) => snapshot.societary_validity.ok && snapshot.status_resolucion === "ADOPTED"
  );
  const blockedSnapshots = snapshots.filter(
    (snapshot) => !snapshot.societary_validity.ok || snapshot.status_resolucion !== "ADOPTED"
  );
  const contractualWarnings = certifiableSnapshots.filter(
    (snapshot) => !snapshot.pacto_compliance.ok
  );
  const referenceDetails = certifiableSnapshots.map((snapshot): CertificationReferenceDetail => {
    const resolution = byIndex.get(snapshot.agenda_item_index);
    if (resolution?.agreement_id) {
      return {
        ref: resolution.agreement_id,
        agenda_item_index: snapshot.agenda_item_index,
        resolution_id: resolution.id,
        resolution_status: resolution.status,
        kind: "agreement_id",
        materializedAgreement: true,
      };
    }
    return {
      ref: `meeting:${params.meetingId}:point:${snapshot.agenda_item_index}`,
      agenda_item_index: snapshot.agenda_item_index,
      resolution_id: resolution?.id ?? null,
      resolution_status: resolution?.status ?? null,
      kind: "meeting_point",
      materializedAgreement: false,
    };
  });
  const refs = referenceDetails.map((reference) => reference.ref);
  const agreementRefs = referenceDetails
    .filter((reference) => reference.kind === "agreement_id")
    .map((reference) => reference.ref);
  const pointRefs = referenceDetails
    .filter((reference) => reference.kind === "meeting_point")
    .map((reference) => reference.ref);
  const warnings = [
    ...contractualWarnings.map((snapshot) => `pacto_warning_point_${snapshot.agenda_item_index}`),
    ...blockedSnapshots.map((snapshot) => `excluded_non_proclaimable_point_${snapshot.agenda_item_index}`),
    ...referenceDetails
      .filter((reference) => reference.kind === "meeting_point")
      .map((reference) => `certifiable_point_without_agreement_id_${reference.agenda_item_index}`),
  ];

  return {
    refs,
    agreementRefs,
    pointRefs,
    referenceDetails,
    hasPointSnapshots: true,
    certifiableSnapshots,
    blockedSnapshots,
    contractualWarnings,
    warnings,
    requiresAgreementLink: pointRefs.length > 0,
    evidenceReadiness: certifiableSnapshots.length === 0
      ? "BLOCKED"
      : pointRefs.length > 0
        ? "CERTIFIABLE_WITH_POINT_REFS"
        : "FINAL_READY",
  };
}
