export interface SignatureRequestRecordSigner {
  name: string;
  email: string;
  surnames?: string;
  sequence?: number;
  personId?: string;
  signerRole?: "PRESIDENTE" | "SECRETARIO" | "CERTIFICANTE" | "VISTO_BUENO" | "ADMINISTRADOR";
  authorityEvidenceId?: string;
}

export interface SignatureRequestRecordResult {
  sandbox?: boolean;
  srId: string;
  caseFileId?: string;
  srStatus?: string;
  signatureProduced?: boolean;
  documentId: string;
  documentHash: string;
  signatoryIds: string[];
  /** Exact mode accepted for the provider request. Absent only in declared sandbox results. */
  providerSignatureType?: "INTERPOSITION";
  providerRequestedAt?: string;
  providerActivatedAt?: string;
  signed_at: string | null;
  errors: string[];
}

export interface BuildSignatureRequestRecordInput {
  tenantId: string;
  agreementId?: string | null;
  documentType: string;
  createdBy: string;
  sourceDomain?: "MINUTE" | "CERTIFICATION" | "ANNUAL_ACCOUNTS";
  sourceId?: string;
  artifactKind?: "MINUTE_FINAL" | "CERTIFICATION_FINAL" | "ANNUAL_ACCOUNTS_EXECUTION";
  contentHashSha256?: string;
  signatories: SignatureRequestRecordSigner[];
  result: SignatureRequestRecordResult;
  recordedAt: string;
}

export function normalizeSignatureRequestStatus(
  result: Pick<SignatureRequestRecordResult, "srStatus" | "signatureProduced">,
): "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "ERROR" | "EXPIRED" {
  if (result.signatureProduced === true) return "COMPLETED";
  const status = result.srStatus?.trim().toUpperCase();
  if (
    status === "DRAFT" ||
    status === "ACTIVE" ||
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "ERROR" ||
    status === "EXPIRED"
  ) {
    return status;
  }
  // Una operación legacy que devuelve IDs ya está iniciada; un estado
  // desconocido nunca se eleva a un efecto personal ni a una firma.
  return "ACTIVE";
}

export function buildSignatureRequestRecord(input: BuildSignatureRequestRecordInput) {
  const status = normalizeSignatureRequestStatus(input.result);
  const providerRequestedAtMs = Date.parse(input.result.providerRequestedAt ?? "");
  const providerActivatedAtMs = Date.parse(input.result.providerActivatedAt ?? "");
  const providerCompletedAtMs = Date.parse(input.result.signed_at ?? "");
  if (
    input.result.sandbox !== true
    && (
      input.result.providerSignatureType !== "INTERPOSITION"
      || !Number.isFinite(providerRequestedAtMs)
      || providerRequestedAtMs > Date.now()
      || (
        input.result.providerActivatedAt !== undefined
        && (!Number.isFinite(providerActivatedAtMs) || providerActivatedAtMs < providerRequestedAtMs)
      )
      || (
        status === "COMPLETED"
        && (!Number.isFinite(providerCompletedAtMs) || providerCompletedAtMs < providerRequestedAtMs)
      )
    )
  ) {
    throw new Error(
      "La solicitud real debe persistir el tipo exacto y la cronología emitida por EAD Trust.",
    );
  }
  const sourceBound = Boolean(
    input.sourceDomain || input.sourceId || input.artifactKind || input.contentHashSha256,
  );
  if (sourceBound) {
    const expectedKind = input.sourceDomain === "MINUTE"
      ? "MINUTE_FINAL"
      : input.sourceDomain === "CERTIFICATION"
        ? "CERTIFICATION_FINAL"
        : input.sourceDomain === "ANNUAL_ACCOUNTS"
          ? "ANNUAL_ACCOUNTS_EXECUTION"
          : null;
    const annualAccounts = input.sourceDomain === "ANNUAL_ACCOUNTS";
    if (
      !input.sourceDomain ||
      !input.sourceId ||
      input.artifactKind !== expectedKind ||
      !/^[0-9a-f]{64}$/.test(input.contentHashSha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(input.result.documentHash.toLowerCase()) ||
      !input.result.caseFileId ||
      input.result.signatoryIds.length !== input.signatories.length ||
      input.result.signatoryIds.some((id) => !id.trim()) ||
      input.signatories.some((signer) => (
        !signer.personId
        || !signer.signerRole
        || (annualAccounts
          ? signer.signerRole !== "ADMINISTRADOR"
          : !signer.authorityEvidenceId || signer.signerRole === "ADMINISTRADOR")
      ))
    ) {
      throw new Error(
        "La solicitud autoritativa exige fuente, hash canónico y autoridad persistida de cada firmante.",
      );
    }
  }

  return {
    tenant_id: input.tenantId,
    agreement_id: input.agreementId ?? null,
    source_domain: input.sourceDomain ?? null,
    source_id: input.sourceId ?? null,
    artifact_kind: input.artifactKind ?? null,
    content_hash_sha256: input.contentHashSha256 ?? null,
    document_hash: input.result.documentHash,
    document_type: input.documentType,
    sr_id: input.result.srId,
    sr_status: status,
    document_id: input.result.documentId,
    signatories: input.signatories.map((signer, index) => ({
      name: signer.name,
      email: signer.email,
      surnames: signer.surnames ?? null,
      sequence: signer.sequence ?? index + 1,
      provider_signatory_id: input.result.signatoryIds[index] ?? null,
      // La tabla vigente no tiene columna case_file_id. Se conserva dentro de
      // cada firmante para poder reconciliar estado/artefactos sin migración Cloud.
      case_file_id: input.result.caseFileId ?? null,
      provider_signature_type: input.result.sandbox === true
        ? null
        : input.result.providerSignatureType,
      source_domain: input.sourceDomain ?? null,
      source_id: input.sourceId ?? null,
      artifact_kind: input.artifactKind ?? null,
      content_hash_sha256: input.contentHashSha256 ?? null,
      person_id: signer.personId ?? null,
      signer_role: signer.signerRole ?? null,
      authority_evidence_id: signer.authorityEvidenceId ?? null,
    })),
    evidence_status: input.result.sandbox === true
      ? "SANDBOX_DEMO_NO_PROVIDER_EFFECT"
      : status === "COMPLETED"
        ? "EAD_INTERPOSITION_COMPLETED_PENDING_CUSTODY"
        : "EAD_INTERPOSITION_REQUESTED",
    requested_at: input.result.sandbox === true
      ? input.recordedAt
      : input.result.providerRequestedAt,
    activated_at: input.result.sandbox === true || status === "DRAFT"
      ? null
      : input.result.providerActivatedAt ?? null,
    // Columna legacy: nunca se fabrica la hora ni se interpreta como firma. Si
    // el proveedor no entrega una terminación individual, queda null.
    completed_at: status === "COMPLETED" ? input.result.signed_at : null,
    created_by: input.createdBy,
    error_message: input.result.errors.length > 0 ? input.result.errors.join(" | ") : null,
  };
}
