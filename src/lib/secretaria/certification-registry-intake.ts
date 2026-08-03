export interface CertificationRegistryIntakeInput {
  id: string;
  minuteId?: string | null;
  agreementId?: string | null;
  agreementsCertified?: string[] | null;
  resolvedPointAgreementIds?: string[] | null;
  unresolvedPointReferences?: string[] | null;
  signatureStatus?: string | null;
  legalGateStatus?: string | null;
  interpositionCanonicalStatus?: string | null;
  evidenceId?: string | null;
  baseDocumentArtifactId?: string | null;
  baseDocumentUrl?: string | null;
  gateHash?: string | null;
  entityId?: string | null;
  bodyId?: string | null;
  meetingId?: string | null;
}

export interface CertificationRegistryIntake {
  id: string;
  minuteId: string | null;
  signatureStatus: string;
  legalGateStatus: string;
  interpositionCanonicalStatus: string | null;
  evidenceId: string | null;
  baseDocumentArtifactId: string | null;
  baseDocumentUrl: string | null;
  gateHash: string | null;
  entityId: string | null;
  bodyId: string | null;
  meetingId: string | null;
  references: string[];
  agreementIds: string[];
  explicitAgreementIds: string[];
  resolvedPointAgreementIds: string[];
  pointReferences: string[];
  unresolvedPointReferences: string[];
  signed: boolean;
  evidenced: boolean;
  hasEvidenceBundle: boolean;
  readyForRegistry: boolean;
  warnings: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEETING_POINT_RE = /^meeting:([^:]+):point:(\d+)$/i;

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value?.trim())));
}

export function isUuidReference(value: string | null | undefined) {
  return !!value && UUID_RE.test(value);
}

export function parseMeetingPointReference(value: string | null | undefined) {
  const match = value?.match(MEETING_POINT_RE);
  if (!match) return null;
  const agendaItemIndex = Number(match[2]);
  if (!Number.isInteger(agendaItemIndex) || agendaItemIndex < 1) return null;
  return {
    meetingId: match[1],
    agendaItemIndex,
  };
}

export function isCertificationEvidenced(input: {
  signatureStatus?: string | null;
  legalGateStatus?: string | null;
  interpositionCanonicalStatus?: string | null;
}) {
  const signatureStatus = String(input.signatureStatus ?? "").toUpperCase();
  const legalGateStatus = String(input.legalGateStatus ?? "").toUpperCase();
  const canonicalStatus = String(input.interpositionCanonicalStatus ?? "").toUpperCase();
  return (
    ["EVIDENCED", "EMITTED", "SIGNED", "FIRMADA", "EMITIDA", "ISSUED", "SEALED"].includes(signatureStatus)
    || ["INTERPOSITION_VERIFIED", "EMITTED"].includes(legalGateStatus)
    || canonicalStatus === "CONSTANCIA_VERIFIED"
  );
}

export function buildCertificationRegistryIntake(
  input: CertificationRegistryIntakeInput,
): CertificationRegistryIntake {
  const references = uniqueNonEmpty([
    input.agreementId,
    ...(input.agreementsCertified ?? []),
  ]);
  const explicitAgreementIds = references.filter(isUuidReference);
  const resolvedPointAgreementIds = uniqueNonEmpty(input.resolvedPointAgreementIds ?? []).filter(isUuidReference);
  const agreementIds = uniqueNonEmpty([...explicitAgreementIds, ...resolvedPointAgreementIds]);
  const pointReferences = references.filter((reference) => !isUuidReference(reference));
  const unresolvedPointReferences = input.unresolvedPointReferences ?? pointReferences;
  const signatureStatus = input.signatureStatus ?? "UNKNOWN";
  const legalGateStatus = input.legalGateStatus ?? "UNKNOWN";
  const interpositionCanonicalStatus = input.interpositionCanonicalStatus ?? null;
  const signed = ["SIGNED", "FIRMADA"].includes(signatureStatus.toUpperCase());
  const evidenced = isCertificationEvidenced({
    signatureStatus,
    legalGateStatus,
    interpositionCanonicalStatus,
  });
  const hasEvidenceBundle = Boolean(input.evidenceId);
  const readyForRegistry =
    evidenced &&
    hasEvidenceBundle &&
    unresolvedPointReferences.length === 0 &&
    agreementIds.length > 0;
  const warnings = [
    evidenced ? null : "certification_not_evidenced",
    hasEvidenceBundle ? null : "evidence_bundle_not_linked",
    unresolvedPointReferences.length > 0 ? "point_references_without_agreement_id" : null,
    resolvedPointAgreementIds.length > 0 ? "point_references_resolved_to_agreement_id" : null,
    agreementIds.length === 0 ? "no_registry_agreement_reference" : null,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    id: input.id,
    minuteId: input.minuteId ?? null,
    signatureStatus,
    legalGateStatus,
    interpositionCanonicalStatus,
    evidenceId: input.evidenceId ?? null,
    baseDocumentArtifactId: input.baseDocumentArtifactId ?? null,
    baseDocumentUrl: input.baseDocumentUrl ?? null,
    gateHash: input.gateHash ?? null,
    entityId: input.entityId ?? null,
    bodyId: input.bodyId ?? null,
    meetingId: input.meetingId ?? null,
    references,
    agreementIds,
    explicitAgreementIds,
    resolvedPointAgreementIds,
    pointReferences,
    unresolvedPointReferences,
    signed,
    evidenced,
    hasEvidenceBundle,
    readyForRegistry,
    warnings,
  };
}
