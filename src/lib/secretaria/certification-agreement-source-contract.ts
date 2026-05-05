export type CertificationAgreementSourceStatus = "READY" | "BLOCKED";

export interface CertificationAgreementSourceInput {
  certificationId: string;
  agreementId?: string | null;
  agreementStatus?: string | null;
  adoptionMode?: string | null;
  entityId?: string | null;
  bodyId?: string | null;
  decisionDate?: string | null;
  agreementKind?: string | null;
  decisionText?: string | null;
  evidenceId?: string | null;
  gateHash?: string | null;
}

export interface CertificationAgreementSourceContract {
  schema_version: "certification-agreement-source.v1";
  status: CertificationAgreementSourceStatus;
  certification_id: string;
  source_table: "agreements";
  source_id: string | null;
  agreement_id: string | null;
  agreement_refs: string[];
  point_refs: string[];
  adoption_mode: string | null;
  entity_id: string | null;
  body_id: string | null;
  decision_date: string | null;
  agreement_kind: string | null;
  decision_text: string | null;
  evidence_id: string | null;
  gate_hash: string | null;
  blockers: string[];
  warnings: string[];
}

function value(input: string | null | undefined) {
  return input?.trim() || null;
}

export function buildCertificationAgreementSourceContract(
  input: CertificationAgreementSourceInput,
): CertificationAgreementSourceContract {
  const agreementId = value(input.agreementId);
  const agreementStatus = value(input.agreementStatus)?.toUpperCase() ?? null;
  const blockers = [
    agreementId ? null : "agreement_id_required",
    agreementStatus === "ADOPTED" || agreementStatus === "APROBADO" ? null : "agreement_not_adopted",
    value(input.decisionText) ? null : "decision_text_required",
  ].filter((blocker): blocker is string => Boolean(blocker));

  const warnings = [
    value(input.evidenceId) ? null : "evidence_bundle_not_linked",
    value(input.gateHash) ? null : "gate_hash_not_available",
  ].filter((warning): warning is string => Boolean(warning));

  return {
    schema_version: "certification-agreement-source.v1",
    status: blockers.length > 0 ? "BLOCKED" : "READY",
    certification_id: input.certificationId,
    source_table: "agreements",
    source_id: agreementId,
    agreement_id: agreementId,
    agreement_refs: agreementId ? [agreementId] : [],
    point_refs: [],
    adoption_mode: value(input.adoptionMode),
    entity_id: value(input.entityId),
    body_id: value(input.bodyId),
    decision_date: value(input.decisionDate),
    agreement_kind: value(input.agreementKind),
    decision_text: value(input.decisionText),
    evidence_id: value(input.evidenceId),
    gate_hash: value(input.gateHash),
    blockers,
    warnings,
  };
}
