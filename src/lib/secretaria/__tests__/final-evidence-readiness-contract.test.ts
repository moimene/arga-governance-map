import { describe, expect, it } from "vitest";
import {
  resolveFinalEvidenceReadiness,
  type FinalEvidenceReadinessInput,
} from "../final-evidence-readiness-contract";

const SATISFIED_GATE = { satisfied: true, reference: "approved:demo-ref" };

function allGates(overrides: FinalEvidenceReadinessInput = {}): FinalEvidenceReadinessInput {
  return {
    sourceArtifact: {
      posture: "FINAL_PROMOTION_CANDIDATE",
      hasOwnerRecord: true,
      hasStorageObject: true,
      hasContentHash: true,
      hasEvidenceBundle: true,
    },
    auditClosure: SATISFIED_GATE,
    retentionClosure: SATISFIED_GATE,
    legalHoldClosure: SATISFIED_GATE,
    evidencePolicyApproval: SATISFIED_GATE,
    explicitPromotionApproval: SATISFIED_GATE,
    ...overrides,
  };
}

describe("final-evidence-readiness-contract", () => {
  it("cierra por defecto con input vacio", () => {
    const result = resolveFinalEvidenceReadiness();

    expect(result.ready).toBe(false);
    expect(result.finalProductiveEvidence).toBe(false);
    expect(result.blockedBy).toContain("SOURCE_ARTIFACT_NOT_PROMOTION_CANDIDATE");
    expect(result.blockedBy).toContain("AUDIT_NOT_CLOSED");
    expect(result.postureLabel).toBe("Evidencia demo/operativa; no final productiva");
  });

  it("no promociona evidencia demo/operativa aunque existan gates tecnicos", () => {
    const result = resolveFinalEvidenceReadiness(
      allGates({
        sourceArtifact: {
          posture: "DEMO_EVIDENCE_BUNDLE_NOT_FINAL",
          hasOwnerRecord: true,
          hasStorageObject: true,
          hasContentHash: true,
          hasEvidenceBundle: true,
        },
      }),
    );

    expect(result.ready).toBe(false);
    expect(result.finalProductiveEvidence).toBe(false);
    expect(result.blockedBy).toEqual(["SOURCE_ARTIFACT_NOT_PROMOTION_CANDIDATE"]);
  });

  it("bloquea si falta cierre de auditoria", () => {
    const result = resolveFinalEvidenceReadiness(allGates({ auditClosure: { satisfied: false, reference: "audit" } }));

    expect(result.ready).toBe(false);
    expect(result.blockedBy).toContain("AUDIT_NOT_CLOSED");
  });

  it("bloquea si falta cierre de retencion", () => {
    const result = resolveFinalEvidenceReadiness(allGates({ retentionClosure: null }));

    expect(result.ready).toBe(false);
    expect(result.blockedBy).toContain("RETENTION_NOT_CLOSED");
  });

  it("bloquea si falta cierre o no aplicabilidad de legal hold", () => {
    const result = resolveFinalEvidenceReadiness(allGates({ legalHoldClosure: { satisfied: true } }));

    expect(result.ready).toBe(false);
    expect(result.blockedBy).toContain("LEGAL_HOLD_NOT_CLOSED");
  });

  it("bloquea si falta aprobacion de politica probatoria", () => {
    const result = resolveFinalEvidenceReadiness(allGates({ evidencePolicyApproval: { satisfied: true, reference: "" } }));

    expect(result.ready).toBe(false);
    expect(result.blockedBy).toContain("EVIDENCE_POLICY_NOT_APPROVED");
  });

  it("bloquea si falta aprobacion explicita de promocion", () => {
    const result = resolveFinalEvidenceReadiness(allGates({ explicitPromotionApproval: undefined }));

    expect(result.ready).toBe(false);
    expect(result.blockedBy).toContain("EXPLICIT_PROMOTION_NOT_APPROVED");
  });

  it("bloquea posturas desconocidas", () => {
    const result = resolveFinalEvidenceReadiness(
      allGates({ sourceArtifact: { posture: "MYSTERY", hasOwnerRecord: true, hasStorageObject: true, hasContentHash: true, hasEvidenceBundle: true } }),
    );

    expect(result.ready).toBe(false);
    expect(result.blockedBy).toContain("SOURCE_ARTIFACT_NOT_PROMOTION_CANDIDATE");
  });

  it("solo declara readiness cuando todos los gates estan satisfechos explicitamente", () => {
    const result = resolveFinalEvidenceReadiness(allGates());

    expect(result.ready).toBe(true);
    expect(result.finalProductiveEvidence).toBe(true);
    expect(result.blockedBy).toEqual([]);
    expect(result.postureLabel).toContain("Readiness final productiva satisfecha");
    expect(result.reasons.join(" ")).toContain("no muta");
  });

  it("no muta el input y mantiene determinismo", () => {
    const input = allGates();
    const before = JSON.stringify(input);

    expect(resolveFinalEvidenceReadiness(input)).toEqual(resolveFinalEvidenceReadiness(input));
    expect(JSON.stringify(input)).toBe(before);
  });
});
