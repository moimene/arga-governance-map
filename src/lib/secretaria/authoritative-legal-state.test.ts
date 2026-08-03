import { describe, expect, it } from "vitest";
import {
  certificationSignatureForPresentation,
  DEMO_SIMULATION_NO_LEGAL_EFFECT_NOTICE,
  minuteHasLegalSignature,
  minuteSignedAtForPresentation,
  prependDemoSimulationNotice,
  resolveCertificationSourceGate,
  resolveMinuteApprovalGate,
  type AuthoritativeEadVerification,
  type AuthoritativeLegalArtifact,
} from "./authoritative-legal-state";

const artifact: AuthoritativeLegalArtifact = {
  id: "00000000-0000-4000-8000-000000000101",
  tenant_id: "00000000-0000-4000-8000-000000000001",
  source_domain: "MINUTE",
  source_id: "00000000-0000-4000-8000-000000000201",
  artifact_kind: "MINUTE_FINAL",
  content_hash_sha256: "a".repeat(64),
  binary_hash_sha256: "b".repeat(64),
  binary_hash_sha512: "c".repeat(128),
  signature_packaging: null,
  evidence_mode: "INTERPOSITION_CUSTODY",
  evidence_bundle_id: "00000000-0000-4000-8000-000000000301",
  artifact_status: "FINAL_IMMUTABLE",
  immutable_at: "2026-07-20T12:00:00.000Z",
};

function verification(
  role: "PRESIDENTE" | "SECRETARIO",
  suffix: string,
): AuthoritativeEadVerification {
  return {
    id: `00000000-0000-4000-8000-0000000004${suffix}`,
    tenant_id: artifact.tenant_id,
    legal_artifact_id: artifact.id,
    signer_person_id: `00000000-0000-4000-8000-0000000006${suffix}`,
    signer_role: role,
    provider: "EAD_TRUST",
    provider_mode: "INTERPOSITION",
    signature_claim: false,
    evidence_purpose: role === "PRESIDENTE" ? "CONSENT" : "CONSTANCIA",
    provider_reference: `SR-1:SIGNER-${suffix}`,
    provider_evidence_bundle_id: artifact.evidence_bundle_id,
    verification_status: "VERIFIED",
    verified_at: "2026-07-20T12:05:00.000Z",
  };
}

describe("authoritative legal UI gates", () => {
  it("habilita aprobación solo con artefacto final, dos verificaciones EAD y destino RESOLVED", () => {
    const result = resolveMinuteApprovalGate({
      legalGateStatus: "ARTIFACT_FINAL",
      finalLegalArtifactId: artifact.id,
      bookDestinationStatus: "RESOLVED",
      evidence: {
        artifact,
        verifications: [verification("PRESIDENTE", "01"), verification("SECRETARIO", "02")],
      },
    });

    expect(result).toEqual({ ready: true, reason: null });
  });

  it("rechaza una única evidencia reutilizada para Presidencia y Secretaría", () => {
    const president = verification("PRESIDENTE", "01");
    const secretary = {
      ...verification("SECRETARIO", "02"),
      provider_reference: president.provider_reference,
    };

    const result = resolveMinuteApprovalGate({
      legalGateStatus: "ARTIFACT_FINAL",
      finalLegalArtifactId: artifact.id,
      bookDestinationStatus: "RESOLVED",
      evidence: { artifact, verifications: [president, secretary] },
    });

    expect(result.ready).toBe(false);
    expect(result.reason).toContain("individuales y diferenciados");
  });

  it("nunca promueve DEMO_SIMULATION aunque haya artefacto y evidencias", () => {
    const result = resolveMinuteApprovalGate({
      legalGateStatus: "DEMO_SIMULATION",
      finalLegalArtifactId: artifact.id,
      bookDestinationStatus: "RESOLVED",
      evidence: {
        artifact,
        verifications: [verification("PRESIDENTE", "01"), verification("SECRETARIO", "02")],
      },
    });

    expect(result.ready).toBe(false);
    expect(result.reason).toContain("simulación demo");
  });

  it("DEMO_SIMULATION domina signed_at, is_locked y signature_status legacy", () => {
    const minute = {
      legalGateStatus: "DEMO_SIMULATION" as const,
      signedAt: "2026-08-08T12:00:00.000Z",
      isLocked: true,
    };

    expect(minuteHasLegalSignature(minute)).toBe(false);
    expect(minuteSignedAtForPresentation(minute)).toBeNull();
    expect(
      certificationSignatureForPresentation({
        legalGateStatus: "DEMO_SIMULATION",
        signatureStatus: "SIGNED",
      }),
    ).toEqual({
      hasLegalEffect: false,
      status: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
      label: "Simulación demo sin efecto jurídico",
    });
  });

  it("antepone el aviso sin efecto jurídico en la exportación aunque el cuerpo legacy diga firmado", () => {
    const exported = prependDemoSimulationNotice(
      "CERTIFICACIÓN FIRMADA Y EMITIDA",
      "DEMO_SIMULATION",
    );

    expect(exported.startsWith(DEMO_SIMULATION_NO_LEGAL_EFFECT_NOTICE)).toBe(true);
    expect(exported).toContain("CERTIFICACIÓN FIRMADA Y EMITIDA");
    expect(prependDemoSimulationNotice(exported, "DEMO_SIMULATION")).toBe(exported);
  });

  it("mantiene la certificación bloqueada tras aprobar hasta que el libro esté POSTED", () => {
    expect(
      resolveCertificationSourceGate({
        minuteLegalGateStatus: "APPROVED_SIGNED",
        bookDestinationStatus: "RESOLVED",
        approvalEvidenceMode: "INTERPOSITION",
        approvalSignatureClaim: false,
        approvalCanonicalStatus: "APPROVED_EVIDENCED",
      }),
    ).toMatchObject({ ready: false });

    expect(
      resolveCertificationSourceGate({
        minuteLegalGateStatus: "APPROVED_SIGNED",
        bookDestinationStatus: "POSTED",
        approvalEvidenceMode: "INTERPOSITION",
        approvalSignatureClaim: false,
        approvalCanonicalStatus: "APPROVED_EVIDENCED",
      }),
    ).toEqual({ ready: true, reason: null });
  });
});
