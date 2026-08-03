export type MinuteLegalGateStatus =
  | "DRAFT"
  | "MANIFEST_READY"
  | "ARTIFACT_FINAL"
  | "APPROVED_SIGNED"
  | "LEGACY_REVIEW"
  | "DEMO_SIMULATION";

export type CertificationLegalGateStatus =
  | "DRAFT"
  | "ARTIFACT_FINAL"
  | "INTERPOSITION_VERIFIED"
  | "SIGNATURE_VERIFIED"
  | "EMITTED"
  | "LEGACY_REVIEW"
  | "DEMO_SIMULATION";

/** Campo nominal legacy: la única modalidad vigente no afirma firma electrónica. */
export type EadSignatureType = "INTERPOSITION";
export type MinuteApprovalMethod =
  | "AL_FINAL_SESION"
  | "DENTRO_15_DIAS"
  | "POR_ACTA_NOTARIAL";

export type AuthoritativeSignerRole =
  | "PRESIDENTE"
  | "SECRETARIO"
  | "CERTIFICANTE"
  | "VISTO_BUENO";

export interface AuthoritativeLegalArtifact {
  id: string;
  tenant_id: string;
  source_domain: "MINUTE" | "CERTIFICATION";
  source_id: string;
  artifact_kind: "MINUTE_FINAL" | "CERTIFICATION_FINAL";
  content_hash_sha256: string;
  binary_hash_sha256: string;
  binary_hash_sha512: string;
  signature_packaging: "ENVELOPED" | "DETACHED" | "PROVIDER_ATTESTATION" | null;
  evidence_mode: "LEGACY_SIGNATURE_WORKFLOW" | "INTERPOSITION_CUSTODY";
  evidence_bundle_id: string;
  artifact_status: "FINAL_IMMUTABLE" | "REVOKED";
  immutable_at: string;
}

export interface AuthoritativeEadEvidence {
  id: string;
  tenant_id: string;
  legal_artifact_id: string;
  signer_person_id: string;
  signer_role: AuthoritativeSignerRole;
  provider: "EAD_TRUST";
  provider_mode: "INTERPOSITION";
  signature_claim: false;
  evidence_purpose: "CONSENT" | "CONSTANCIA";
  provider_reference: string;
  provider_evidence_bundle_id: string;
  verification_status: "VERIFIED";
  verified_at: string;
}

/** Alias de compatibilidad nominal: estas filas son evidencias, no firmas. */
export type AuthoritativeEadVerification = AuthoritativeEadEvidence;

export interface AuthoritativeEvidenceState {
  artifact: AuthoritativeLegalArtifact | null;
  verifications: AuthoritativeEadVerification[];
}

export interface LegalGateDecision {
  ready: boolean;
  reason: string | null;
}

export const DEMO_SIMULATION_NO_LEGAL_EFFECT_NOTICE =
  "SIMULACIÓN DEMO — SIN EFECTOS JURÍDICOS. Las marcas históricas de firma, bloqueo o emisión no acreditan aprobación ni certificación.";

/**
 * Proyección única para listados y exportaciones. Los campos legacy signed_at
 * e is_locked nunca prevalecen sobre la clasificación jurídica explícita.
 */
export function minuteHasLegalSignature(params: {
  legalGateStatus?: MinuteLegalGateStatus | null;
  signedAt?: string | null;
  isLocked?: boolean | null;
  approvalEvidenceMode?: string | null;
  approvalSignatureClaim?: boolean | null;
  approvalCanonicalStatus?: string | null;
}) {
  return params.legalGateStatus === "APPROVED_SIGNED"
    && Boolean(params.signedAt)
    && params.isLocked === true
    && params.approvalEvidenceMode === "INTERPOSITION"
    && params.approvalSignatureClaim === false
    && params.approvalCanonicalStatus === "APPROVED_EVIDENCED";
}

export function minuteSignedAtForPresentation(params: {
  legalGateStatus?: MinuteLegalGateStatus | null;
  signedAt?: string | null;
  isLocked?: boolean | null;
  approvalEvidenceMode?: string | null;
  approvalSignatureClaim?: boolean | null;
  approvalCanonicalStatus?: string | null;
}) {
  return minuteHasLegalSignature(params) ? params.signedAt ?? null : null;
}

export function certificationSignatureForPresentation(params: {
  legalGateStatus?: CertificationLegalGateStatus | null;
  signatureStatus?: string | null;
}) {
  if (params.legalGateStatus === "DEMO_SIMULATION") {
    return {
      hasLegalEffect: false,
      status: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
      label: "Simulación demo sin efecto jurídico",
    } as const;
  }
  const hasLegalEffect =
    (
      params.legalGateStatus === "INTERPOSITION_VERIFIED"
      || params.legalGateStatus === "EMITTED"
    )
    && params.signatureStatus?.toUpperCase() === "EVIDENCED";
  return {
    hasLegalEffect,
    status: hasLegalEffect ? "EVIDENCED" : params.signatureStatus ?? "PENDING",
    label: hasLegalEffect
      ? "Intervención EAD verificada y evidencia jurídica registrada"
      : "Pendiente de evidencia jurídica verificada",
  } as const;
}

export function prependDemoSimulationNotice(
  content: string,
  legalGateStatus?: MinuteLegalGateStatus | CertificationLegalGateStatus | null,
) {
  if (legalGateStatus !== "DEMO_SIMULATION") return content;
  if (content.startsWith(DEMO_SIMULATION_NO_LEGAL_EFFECT_NOTICE)) return content;
  return `${DEMO_SIMULATION_NO_LEGAL_EFFECT_NOTICE}\n\n${content}`;
}

export function verifiedSigner(
  verifications: AuthoritativeEadVerification[],
  role: AuthoritativeSignerRole,
) {
  return verifications.find(
    (verification) =>
      verification.signer_role === role &&
      verification.provider === "EAD_TRUST" &&
      verification.verification_status === "VERIFIED" &&
      verification.provider_mode === "INTERPOSITION" &&
      verification.signature_claim === false &&
      verification.evidence_purpose === (
        role === "PRESIDENTE" ? "CONSENT" : "CONSTANCIA"
      ),
  );
}

export function resolveMinuteApprovalGate(params: {
  legalGateStatus: MinuteLegalGateStatus;
  finalLegalArtifactId?: string | null;
  bookDestinationStatus?: string | null;
  evidence: AuthoritativeEvidenceState;
}): LegalGateDecision {
  if (params.legalGateStatus === "DEMO_SIMULATION") {
    return {
      ready: false,
      reason:
        "Este registro es una simulación demo y no puede convertirse en un acta jurídicamente aprobada.",
    };
  }
  if (params.legalGateStatus === "LEGACY_REVIEW") {
    return {
      ready: false,
      reason:
        "El acta procede del circuito anterior y requiere remediación probatoria antes de aprobarse.",
    };
  }
  if (params.legalGateStatus === "APPROVED_SIGNED") {
    return { ready: false, reason: "El acta ya está aprobada con evidencia autoritativa." };
  }
  if (params.legalGateStatus !== "ARTIFACT_FINAL") {
    return {
      ready: false,
      reason:
        "Falta el artefacto final inmutable, archivado y verificado por EAD Trust.",
    };
  }

  const artifact = params.evidence.artifact;
  if (
    !artifact ||
    artifact.id !== params.finalLegalArtifactId ||
    artifact.artifact_status !== "FINAL_IMMUTABLE" ||
    artifact.source_domain !== "MINUTE" ||
    artifact.artifact_kind !== "MINUTE_FINAL" ||
    artifact.evidence_mode !== "INTERPOSITION_CUSTODY" ||
    artifact.signature_packaging !== null
  ) {
    return {
      ready: false,
      reason: "El acta no está vinculada al artefacto final inmutable que se intenta aprobar.",
    };
  }

  const president = verifiedSigner(params.evidence.verifications, "PRESIDENTE");
  const secretary = verifiedSigner(params.evidence.verifications, "SECRETARIO");
  if (!president || !secretary) {
    return {
      ready: false,
      reason:
        "Faltan el consentimiento de Presidencia y la constancia de Secretaría en EAD Trust.",
    };
  }
  if (
    president.id === secretary.id ||
    president.signer_person_id === secretary.signer_person_id ||
    president.provider_reference === secretary.provider_reference
  ) {
    return {
      ready: false,
      reason:
        "Presidencia y Secretaría deben aportar consentimientos EAD individuales y diferenciados.",
    };
  }
  if (params.bookDestinationStatus !== "RESOLVED") {
    return {
      ready: false,
      reason:
        "Resuelva primero el libro y la sección de destino; el asiento se practicará tras aprobar el acta.",
    };
  }

  return { ready: true, reason: null };
}

export function resolveCertificationSourceGate(params: {
  minuteLegalGateStatus: MinuteLegalGateStatus;
  bookDestinationStatus?: string | null;
  approvalEvidenceMode?: string | null;
  approvalSignatureClaim?: boolean | null;
  approvalCanonicalStatus?: string | null;
}): LegalGateDecision {
  if (params.minuteLegalGateStatus === "DEMO_SIMULATION") {
    return {
      ready: false,
      reason: "Una simulación demo no puede servir de fuente para una certificación jurídica.",
    };
  }
  if (params.minuteLegalGateStatus === "LEGACY_REVIEW") {
    return {
      ready: false,
      reason: "El acta legacy debe remediarse antes de certificar acuerdos.",
    };
  }
  if (params.minuteLegalGateStatus !== "APPROVED_SIGNED") {
    return {
      ready: false,
      reason:
        "La certificación requiere un acta aprobada sobre su artefacto final y dos consentimientos EAD verificados.",
    };
  }
  if (
    params.approvalEvidenceMode !== "INTERPOSITION"
    || params.approvalSignatureClaim !== false
    || params.approvalCanonicalStatus !== "APPROVED_EVIDENCED"
  ) {
    return {
      ready: false,
      reason:
        "El estado histórico del acta no basta: faltan consentimiento, constancia y canonical gate INTERPOSITION.",
    };
  }
  if (params.bookDestinationStatus !== "POSTED") {
    return {
      ready: false,
      reason:
        "La certificación permanece bloqueada hasta que el acta esté asentada en el libro societario.",
    };
  }
  return { ready: true, reason: null };
}

export function minuteLegalGateLabel(status: MinuteLegalGateStatus) {
  const labels: Record<MinuteLegalGateStatus, string> = {
    DRAFT: "Borrador",
    MANIFEST_READY: "Manifiesto jurídico preparado",
    ARTIFACT_FINAL: "Artefacto final inmutable",
    APPROVED_SIGNED: "Aprobada con consentimiento y constancia EAD",
    LEGACY_REVIEW: "Revisión probatoria legacy",
    DEMO_SIMULATION: "Simulación demo sin efecto jurídico",
  };
  return labels[status];
}

export function certificationLegalGateLabel(status: CertificationLegalGateStatus) {
  const labels: Record<CertificationLegalGateStatus, string> = {
    DRAFT: "Borrador pendiente de artefacto final",
    ARTIFACT_FINAL: "Artefacto final pendiente de constancias EAD",
    INTERPOSITION_VERIFIED: "Constancias EAD verificadas",
    SIGNATURE_VERIFIED: "Flujo histórico pendiente de revisión",
    EMITTED: "Emitida",
    LEGACY_REVIEW: "Revisión probatoria legacy",
    DEMO_SIMULATION: "Simulación demo sin efecto jurídico",
  };
  return labels[status];
}
