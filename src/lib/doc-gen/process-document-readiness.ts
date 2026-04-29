import type {
  AgreementDocumentTrace,
  DocumentEvidencePosture,
} from "@/lib/secretaria/agreement-document-contract";
import {
  resolveFinalEvidenceReadiness,
  type FinalEvidenceGateInput,
  type FinalEvidenceReadinessInput,
  type FinalEvidenceReadinessResult,
} from "@/lib/secretaria/final-evidence-readiness-contract";

export interface ProcessDocumentReadinessArchive {
  archived?: boolean;
  documentUrls?: string[];
  evidenceBundleIds?: string[];
}

export interface ProcessDocumentReadinessSource {
  agreementTrace?: AgreementDocumentTrace | null;
  evidencePosture?: DocumentEvidencePosture | null;
  archive?: ProcessDocumentReadinessArchive | null;
  contentHash?: string | null;
  promotionCandidate?: boolean;
  auditClosure?: FinalEvidenceGateInput | null;
  retentionClosure?: FinalEvidenceGateInput | null;
  legalHoldClosure?: FinalEvidenceGateInput | null;
  evidencePolicyApproval?: FinalEvidenceGateInput | null;
  explicitPromotionApproval?: FinalEvidenceGateInput | null;
}

function hasValue(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildFinalEvidenceReadinessInputFromProcessDocument(
  source: ProcessDocumentReadinessSource,
): FinalEvidenceReadinessInput {
  const archive = source.archive ?? {};

  return {
    sourceArtifact: {
      posture: source.promotionCandidate === true
        ? "FINAL_PROMOTION_CANDIDATE"
        : source.evidencePosture?.status ?? "GENERATED_TRACE_ONLY",
      hasOwnerRecord: source.agreementTrace?.status === "AGREEMENT_LINKED",
      hasStorageObject: (archive.documentUrls?.length ?? 0) > 0,
      hasContentHash: hasValue(source.contentHash),
      hasEvidenceBundle: (archive.evidenceBundleIds?.length ?? 0) > 0,
    },
    auditClosure: source.auditClosure ?? null,
    retentionClosure: source.retentionClosure ?? null,
    legalHoldClosure: source.legalHoldClosure ?? null,
    evidencePolicyApproval: source.evidencePolicyApproval ?? null,
    explicitPromotionApproval: source.explicitPromotionApproval ?? null,
  };
}

export function resolveProcessDocumentFinalEvidenceReadiness(
  source: ProcessDocumentReadinessSource,
): FinalEvidenceReadinessResult {
  return resolveFinalEvidenceReadiness(buildFinalEvidenceReadinessInputFromProcessDocument(source));
}
