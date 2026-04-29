import type { DocumentEvidencePostureStatus } from "./agreement-document-contract";

export type FinalEvidenceSourcePosture =
  | DocumentEvidencePostureStatus
  | "GENERATED_TRACE_ONLY"
  | "ARCHIVED_OPERATIONAL"
  | "BUNDLED_OPERATIONAL"
  | "QTSP_SIGNED_OPERATIONAL"
  | "FINAL_PROMOTION_CANDIDATE"
  | string;

export type FinalEvidenceBlockedBy =
  | "SOURCE_ARTIFACT_NOT_PROMOTION_CANDIDATE"
  | "OWNER_RECORD_MISSING"
  | "STORAGE_OBJECT_MISSING"
  | "CONTENT_HASH_MISSING"
  | "EVIDENCE_BUNDLE_MISSING"
  | "AUDIT_NOT_CLOSED"
  | "RETENTION_NOT_CLOSED"
  | "LEGAL_HOLD_NOT_CLOSED"
  | "EVIDENCE_POLICY_NOT_APPROVED"
  | "EXPLICIT_PROMOTION_NOT_APPROVED";

export interface FinalEvidenceSourceArtifactInput {
  posture?: FinalEvidenceSourcePosture | null;
  hasOwnerRecord?: boolean | null;
  hasStorageObject?: boolean | null;
  hasContentHash?: boolean | null;
  hasEvidenceBundle?: boolean | null;
}

export interface FinalEvidenceGateInput {
  satisfied?: boolean | null;
  reference?: string | null;
}

export interface FinalEvidenceReadinessInput {
  sourceArtifact?: FinalEvidenceSourceArtifactInput | null;
  auditClosure?: FinalEvidenceGateInput | null;
  retentionClosure?: FinalEvidenceGateInput | null;
  legalHoldClosure?: FinalEvidenceGateInput | null;
  evidencePolicyApproval?: FinalEvidenceGateInput | null;
  explicitPromotionApproval?: FinalEvidenceGateInput | null;
}

export interface FinalEvidenceGateResult {
  blockedBy: FinalEvidenceBlockedBy;
  satisfied: boolean;
  reason: string;
}

export interface FinalEvidenceReadinessResult {
  ready: boolean;
  finalProductiveEvidence: boolean;
  postureLabel: string;
  reasons: string[];
  blockedBy: FinalEvidenceBlockedBy[];
  gateResults: FinalEvidenceGateResult[];
}

function hasReference(gate?: FinalEvidenceGateInput | null) {
  return typeof gate?.reference === "string" && gate.reference.trim().length > 0;
}

function gateSatisfied(gate?: FinalEvidenceGateInput | null) {
  return gate?.satisfied === true && hasReference(gate);
}

function sourcePosture(value?: FinalEvidenceSourcePosture | null) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function addGate(
  gateResults: FinalEvidenceGateResult[],
  blockedBy: FinalEvidenceBlockedBy,
  satisfied: boolean,
  reason: string,
) {
  gateResults.push({ blockedBy, satisfied, reason });
}

export function resolveFinalEvidenceReadiness(
  input: FinalEvidenceReadinessInput = {},
): FinalEvidenceReadinessResult {
  const gateResults: FinalEvidenceGateResult[] = [];
  const source = input.sourceArtifact ?? {};
  const posture = sourcePosture(source.posture);

  addGate(
    gateResults,
    "SOURCE_ARTIFACT_NOT_PROMOTION_CANDIDATE",
    posture === "FINAL_PROMOTION_CANDIDATE",
    posture === "FINAL_PROMOTION_CANDIDATE"
      ? "artefacto marcado explicitamente como candidato a promocion"
      : "artefacto actual sigue en postura demo/operativa o desconocida",
  );
  addGate(
    gateResults,
    "OWNER_RECORD_MISSING",
    source.hasOwnerRecord === true,
    "registro owner canonico requerido",
  );
  addGate(
    gateResults,
    "STORAGE_OBJECT_MISSING",
    source.hasStorageObject === true,
    "objeto o referencia storage verificable requerida",
  );
  addGate(
    gateResults,
    "CONTENT_HASH_MISSING",
    source.hasContentHash === true,
    "hash criptografico requerido",
  );
  addGate(
    gateResults,
    "EVIDENCE_BUNDLE_MISSING",
    source.hasEvidenceBundle === true,
    "bundle o manifest probatorio requerido",
  );
  addGate(
    gateResults,
    "AUDIT_NOT_CLOSED",
    gateSatisfied(input.auditClosure),
    "cierre auditado con referencia requerida",
  );
  addGate(
    gateResults,
    "RETENTION_NOT_CLOSED",
    gateSatisfied(input.retentionClosure),
    "politica de retencion cerrada con referencia requerida",
  );
  addGate(
    gateResults,
    "LEGAL_HOLD_NOT_CLOSED",
    gateSatisfied(input.legalHoldClosure),
    "legal hold cerrado o no aplicable con referencia requerida",
  );
  addGate(
    gateResults,
    "EVIDENCE_POLICY_NOT_APPROVED",
    gateSatisfied(input.evidencePolicyApproval),
    "politica probatoria aprobada con referencia requerida",
  );
  addGate(
    gateResults,
    "EXPLICIT_PROMOTION_NOT_APPROVED",
    gateSatisfied(input.explicitPromotionApproval),
    "aprobacion explicita de promocion requerida",
  );

  const failedGates = gateResults.filter((gate) => !gate.satisfied);
  const ready = failedGates.length === 0;

  return {
    ready,
    finalProductiveEvidence: ready,
    postureLabel: ready
      ? "Readiness final productiva satisfecha (sin promocion activa)"
      : posture === "FINAL_PROMOTION_CANDIDATE"
        ? "Promocion productiva pendiente de gates"
        : "Evidencia demo/operativa; no final productiva",
    reasons: ready
      ? [
          "todos los gates de readiness estan satisfechos explicitamente",
          "clasificador puro: no muta, no persiste y no ejecuta promocion",
        ]
      : failedGates.map((gate) => gate.reason),
    blockedBy: failedGates.map((gate) => gate.blockedBy),
    gateResults,
  };
}
