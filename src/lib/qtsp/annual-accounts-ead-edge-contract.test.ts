import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  archiveAnnualAccountsExecutionWithEADTrust,
  buildAnnualAccountsExecutionArchivePayload,
  buildAnnualAccountsExternalSignatureEvidencePayload,
  buildAnnualAccountsMissingSignatureCausePayload,
  buildAnnualAccountsSignatureReconciliationPayload,
  normalizeAnnualAccountsExecutionArchiveResult,
  normalizeAnnualAccountsExternalSignatureEvidenceResult,
  normalizeAnnualAccountsSignatureReconciliationResult,
} from "./qtsp-proxy-client";

const EDGE = readFileSync(
  resolve(process.cwd(), "supabase/functions/qtsp-proxy/index.ts"),
  "utf8",
);
const MIGRATION = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720133000_secretaria_ead_interposition_policy.sql",
  ),
  "utf8",
);

function functionSlice(name: string, next: string): string {
  const start = EDGE.indexOf(`async function ${name}`);
  const end = EDGE.indexOf(`async function ${next}`, start + 1);
  return EDGE.slice(start, end < 0 ? undefined : end);
}

describe("Edge EAD de cuentas anuales", () => {
  const legacy = functionSlice(
    "handleReconcileAnnualAccountsSignature",
    "handleRecordAnnualAccountsExternalSignature",
  );
  const reviewed = functionSlice(
    "handleRecordAnnualAccountsExternalSignature",
    "handleRecordAnnualAccountsMissingCause",
  );
  const cause = functionSlice(
    "handleRecordAnnualAccountsMissingCause",
    "handleArchiveAnnualAccountsExecution",
  );
  const archive = functionSlice("handleArchiveAnnualAccountsExecution", "Deno.serve");

  it("bloquea la inferencia legacy desde una finalización EAD", () => {
    expect(legacy).toContain("authenticateEdgeRequest(req)");
    expect(legacy).toContain("REVIEWED_EXTERNAL_SIGNATURE_REQUIRED");
    expect(legacy).toContain("signatureClaim: false");
    expect(legacy).toContain('replacementAction: "record_annual_accounts_external_signature"');
    expect(legacy).not.toContain("readProviderCompletion");
  });

  it("registra solo una firma externa revisada sobre PDF custodiado", () => {
    expect(reviewed).toContain("secretaria_annual_accounts_signature_review_events");
    expect(reviewed).toContain("reviewEventId");
    expect(reviewed).toContain("review.reviewer_user_id === auth.userId");
    expect(reviewed).toContain("expected signer is not part of the frozen annual-accounts roster");
    expect(reviewed).toContain('decode(bytes.slice(0, 5)) !== "%PDF-"');
    expect(reviewed).toContain('mimeType: "application/pdf"');
    expect(reviewed).toContain('purpose: "EXTERNAL_SIGNATURE_CUSTODY"');
    expect(reviewed).toContain('artifact_role: "EXTERNAL_SIGNATURE_DOCUMENT"');
    expect(reviewed).toContain('provider_mode: "INTERPOSITION"');
    expect(reviewed).toContain('actionKind: "EXTERNAL_SIGNATURE_CUSTODY"');
    expect(reviewed.indexOf("reserveEadProviderAction")).toBeLessThan(
      reviewed.indexOf("archiveAnnualAccountsBinary"),
    );
    expect(reviewed).toContain("signature_claim: false");
    expect(reviewed).toContain('"fn_secretaria_register_ead_interposition_evidence"');
    expect(reviewed).toContain('"fn_secretaria_record_annual_accounts_external_signature"');
    expect(reviewed).not.toContain("SIGNED_EAD");
  });

  it("persiste causas individuales con identidad del usuario, no desde EAD", () => {
    expect(cause).toContain('"fn_secretaria_record_annual_accounts_missing_signature_cause"');
    expect(cause).toContain("auth.userClient.rpc");
    expect(cause).not.toContain("readProviderCompletion");
  });

  it("exige un binario autoritativo antes de cualquier RPC, storage o llamada EAD", () => {
    expect(archive).toContain("authenticateEdgeRequest(req)");
    expect(archive).toContain('code: "AUTHORITATIVE_BINARY_REQUIRED"');
    expect(archive).not.toContain("documentBase64");
    expect(archive).not.toContain("readCanonicalAnnualAccountsSource");
    expect(archive).not.toContain("fn_secretaria_validate_annual_accounts_execution");
    expect(archive).not.toContain("reserveEadProviderAction");
    expect(archive).not.toContain("archiveAnnualAccountsBinary");
    expect(archive).not.toContain("createEadEvidence(");
    expect(archive).not.toContain("fn_secretaria_register_annual_accounts_ead_execution");
    expect(archive).not.toContain('status: "FINAL_ARCHIVED"');
    expect(archive).toContain('providerMode: "INTERPOSITION"');
    expect(archive).toContain("signatureClaim: false");
    expect(archive).toContain("custodyCreated: false");
    expect(archive).toContain("finalArtifactCreated: false");
  });
});

describe("bridge SQL anual por interposición", () => {
  it("exige service_role, roster externo revisado e interposición sin claim", () => {
    const start = MIGRATION.indexOf(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(",
    );
    const end = MIGRATION.indexOf("$function$;", start);
    const bridge = MIGRATION.slice(start, end);
    expect(bridge).toContain("requires service_role");
    expect(bridge).toContain("EXTERNAL_SIGNATURE_ROSTER_COMPLETE");
    expect(bridge).toContain("provider_mode");
    expect(bridge).toContain("INTERPOSITION");
    expect(bridge).toContain("signature_claim");
    expect(bridge).toContain("IS NOT FALSE");
    expect(bridge).toContain("provider_signature_type");
    expect(bridge).toContain("signature_packaging");
  });

  it("hash-vincula set, roster, outcomes y causas antes de FINAL_ARCHIVED", () => {
    const start = MIGRATION.indexOf(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(",
    );
    const bridge = MIGRATION.slice(start);
    expect(bridge).toContain("ANNUAL_ACCOUNTS_EXECUTION_OUTPUT");
    expect(bridge).toContain("annual_accounts_set_manifest_hash_sha256");
    expect(bridge).toContain("signer_roster_hash_sha256");
    expect(bridge).toContain("signer_outcomes_manifest_hash_sha256");
    expect(bridge).toContain("missing_signature_causes_manifest_hash_sha256");
    expect(bridge).toContain("fn_secretaria_register_annual_accounts_execution_artifact(");
    expect(bridge).toContain("'execution_state', v_execution_state");
  });
});

describe("contrato browser mínimo", () => {
  const setId = "11111111-1111-4111-8111-111111111111";
  const signerId = "22222222-2222-4222-8222-222222222222";
  const personId = "33333333-3333-4333-8333-333333333333";
  const bundleId = "44444444-4444-4444-8444-444444444444";
  const evidenceId = "55555555-5555-4555-8555-555555555555";
  const reviewEventId = "66666666-6666-4666-8666-666666666666";
  const reservationId = "77777777-7777-4777-8777-777777777777";

  it("la reconciliación legacy solo recibe coordenadas y normaliza el bloqueo", () => {
    expect(buildAnnualAccountsSignatureReconciliationPayload({
      signatureRequestId: signerId,
      annualAccountsSetId: setId,
      contentHash: "a".repeat(64),
    })).toMatchObject({ action: "reconcile_annual_accounts_signature" });
    expect(normalizeAnnualAccountsSignatureReconciliationResult({
      code: "REVIEWED_EXTERNAL_SIGNATURE_REQUIRED",
      signatureClaim: false,
      replacementAction: "record_annual_accounts_external_signature",
      error: "Revisión humana requerida",
    })).toMatchObject({ signatureClaim: false });
  });

  it("la firma externa requiere revisión explícita y bytes del PDF", () => {
    const payload = buildAnnualAccountsExternalSignatureEvidencePayload({
      annualAccountsSetId: setId,
      expectedSignerId: signerId,
      signedAt: "2025-07-20T10:00:00.000Z",
      signatureFactSource: "REVIEWED_SIGNED_DOCUMENT",
      reviewEventId,
      documentData: new TextEncoder().encode("pdf").buffer as ArrayBuffer,
      fileName: "cuentas-firmadas.pdf",
    });
    expect(payload).toMatchObject({
      action: "record_annual_accounts_external_signature",
      reviewEventId,
      documentBase64: "cGRm",
    });

    const response = {
      provider: "EAD_TRUST",
      providerName: "EAD Trust",
      service: "EVIDENCE_MANAGER",
      providerMode: "INTERPOSITION",
      signatureClaim: false,
      status: "EXTERNAL_SIGNATURE_EVIDENCE_RECORDED",
      sourceDomain: "ANNUAL_ACCOUNTS",
      sourceId: setId,
      expectedSignerId: signerId,
      personId,
      evidenceBundleId: bundleId,
      interpositionEvidenceId: evidenceId,
      outcome: { outcome_type: "EXTERNAL_SIGNATURE_EVIDENCE" },
      signedAt: "2025-07-20T10:00:00.000Z",
      reviewedAt: "2025-07-20T10:05:00.000Z",
      reviewEventId,
      providerActionReservationId: reservationId,
      signatureFactSource: "REVIEWED_SIGNED_DOCUMENT",
      binaryHashSha256: "a".repeat(64),
      binaryHashSha512: "b".repeat(128),
      storagePath: "tenant/secretaria/annual_accounts/reviewed.pdf",
      rosterComplete: false,
      executionState: null,
      reused: false,
    };
    expect(normalizeAnnualAccountsExternalSignatureEvidenceResult(response)).toEqual(response);
  });

  it("la causa sigue siendo individual y codificada", () => {
    expect(buildAnnualAccountsMissingSignatureCausePayload({
      annualAccountsSetId: setId,
      expectedSignerId: signerId,
      causeCode: "ILLNESS_OR_INCAPACITY",
      causeText: "Incapacidad médica acreditada en el expediente.",
    })).toMatchObject({
      action: "record_annual_accounts_missing_signature_cause",
      expectedSignerId: signerId,
    });
  });

  it("la petición de cierre solo contiene coordenadas canónicas y falla antes del proxy", async () => {
    const payload = buildAnnualAccountsExecutionArchivePayload({
      annualAccountsSetId: setId,
      contentHash: "a".repeat(64),
    });
    expect(payload).toEqual({
      action: "archive_annual_accounts_execution",
      annualAccountsSetId: setId,
      contentHash: "a".repeat(64),
    });
    expect(payload).not.toHaveProperty("documentBase64");
    expect(payload).not.toHaveProperty("fileName");
    expect(payload).not.toHaveProperty("mimeType");

    await expect(archiveAnnualAccountsExecutionWithEADTrust({
      annualAccountsSetId: setId,
      contentHash: "a".repeat(64),
    })).rejects.toThrow("AUTHORITATIVE_BINARY_REQUIRED");
  });

  it("solo mantiene lectura estricta de cierres históricos", () => {
    const final = {
      provider: "EAD_TRUST",
      providerName: "EAD Trust",
      service: "EVIDENCE_MANAGER",
      providerMode: "INTERPOSITION",
      signatureClaim: false,
      status: "FINAL_ARCHIVED",
      sourceDomain: "ANNUAL_ACCOUNTS",
      sourceId: setId,
      artifactKind: "ANNUAL_ACCOUNTS_EXECUTION",
      contentHashSha256: "a".repeat(64),
      executionArtifactId: signerId,
      evidenceBundleId: bundleId,
      executionManifestHashSha256: "b".repeat(64),
      binaryHashSha256: "c".repeat(64),
      binaryHashSha512: "d".repeat(128),
      storagePath: "tenant/secretaria/annual_accounts/final.pdf",
      eadCaseFileId: "ead-cf",
      eadEvidenceGroupId: "ead-eg",
      eadEvidenceId: "ead-ev",
      providerActionReservationId: reservationId,
      executionState: { status: "EXTERNAL_SIGNATURE_ROSTER_COMPLETE" },
      reused: false,
      reusedStorage: false,
    };
    expect(normalizeAnnualAccountsExecutionArchiveResult(final)).toEqual(final);
    expect(normalizeAnnualAccountsExecutionArchiveResult({
      ...final,
      executionState: { status: "INCOMPLETE" },
    })).toBeNull();
  });
});
