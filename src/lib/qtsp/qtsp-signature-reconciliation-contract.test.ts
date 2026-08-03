import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "supabase/functions/qtsp-proxy/index.ts"),
  "utf8",
);
const start = source.indexOf("async function handleReconcileVerifiedSignature");
const end = source.indexOf("async function archiveAnnualAccountsBinary", start);
const handler = source.slice(start, end);

describe("reconciliación server-side EAD Trust por interposición", () => {
  it("resuelve una solicitud visible y su fuente antes de contactar EAD", () => {
    expect(handler).toContain("authenticateEdgeRequest(req)");
    expect(handler).toContain("readVisibleSignatureRequest(auth.userClient, coordinates.signatureRequestId)");
    expect(handler).toContain("signatureRequest.tenant_id !== source.tenantId");
    expect(handler).toContain('auth.userClient.rpc("fn_secretaria_assert_role_allowed"');
    expect(handler.indexOf("readVisibleSignatureRequest")).toBeLessThan(
      handler.indexOf("readProviderCompletion"),
    );
    expect(handler).not.toMatch(/body\.(caseFileId|srId|documentId)/);
  });

  it("falla sin binding jurídico, autoridad e identidad individual", () => {
    expect(handler).toContain("parseVerifiedSignerBindings(signatureRequest, source)");
    expect(handler).toContain("assertSignerAuthority");
    expect(source).toContain("authority_evidence_id");
    expect(source).toContain("provider_signatory_id");
  });

  it("solo admite modo INTERPOSITION y finalización real del proveedor", () => {
    expect(source).toContain('persistedProviderMode !== "INTERPOSITION"');
    expect(source).toContain('providerMode !== "INTERPOSITION"');
    expect(source).toContain('status !== "COMPLETED"');
    expect(handler).toContain("provider.requestedAt");
    expect(handler).toContain("provider.completedAt");
    expect(handler).not.toContain("provider.signatureType");
    expect(handler).not.toContain("signaturePackaging");
  });

  it("recupera output, constancia y paquete como artefactos hash-independientes", () => {
    expect(source).toContain("/signed-document-url");
    expect(source).toContain("/certificates/document-url");
    expect(source).toContain("/certificates/package-url");
    expect(handler).toContain('downloadProviderBytes(provider.outputDocumentUrl, "EAD interposition output")');
    expect(handler).toContain('downloadProviderBytes(provider.completionEvidenceDocumentUrl, "EAD completion evidence")');
    expect(handler).toContain('downloadProviderBytes(provider.completionPackageUrl, "EAD completion package")');
    expect(handler).toContain("must be independently hash-bound artifacts");
  });

  it("registra CUSTODIED_BINARY y e-archive sin elevarlo a firma", () => {
    expect(handler).toContain("archiveProviderInterpositionOutput");
    expect(handler).toContain('"fn_secretaria_register_custodied_legal_artifact"');
    expect(handler).toContain('"fn_secretaria_register_ead_interposition_evidence"');
    expect(handler).toContain('p_evidence_purpose: "EARCHIVE"');
    expect(handler).toContain("signature_claim: false");
    expect(handler).toContain('artifactRole: "CUSTODIED_BINARY"');
    expect(handler).not.toContain("fn_secretaria_register_final_legal_artifact");
    expect(handler).not.toContain("fn_secretaria_reconcile_verified_ead_bundle");
    expect(handler).not.toContain("fn_secretaria_register_verified_qtsp_signature");
    expect(handler).not.toContain("SIGNED_OUTPUT");
  });

  it("registra consentimiento/constancia por persona sin nivel de firma", () => {
    expect(handler).toContain('signer.signerRole === "PRESIDENTE" ? "CONSENT"');
    expect(handler).toContain('"CONSTANCIA"');
    expect(handler).toContain("p_subject_person_id: signer.personId");
    expect(handler).toContain("p_subject_role: signer.signerRole");
    expect(handler).toContain("provider_participant_id: providerOutcome.providerParticipantId");
    expect(handler).toContain("authority_evidence_id: signer.authorityEvidenceId");
    expect(handler).not.toContain("providerSignatureType");
    expect(handler).not.toContain("QES");
    expect(handler).not.toContain("ADVANCED");
  });
});

describe("status/artifacts genéricos están retirados", () => {
  it("ambos handlers autentican y terminan sin contactar al proveedor", () => {
    const statusStart = source.indexOf("async function handleStatus");
    const statusEnd = source.indexOf("async function handleArtifacts", statusStart);
    const status = source.slice(statusStart, statusEnd);
    const artifactsStart = source.indexOf("async function handleArtifacts");
    const artifactsEnd = source.indexOf("interface EadEvidenceResult", artifactsStart);
    const artifacts = source.slice(artifactsStart, artifactsEnd);
    for (const secureHandler of [status, artifacts]) {
      expect(secureHandler).toContain("authenticateEdgeRequest(req)");
      expect(secureHandler).toContain("GENERIC_PROVIDER_ACTION_RETIRED");
      expect(secureHandler).not.toContain("readVisibleSignatureRequest");
      expect(secureHandler).not.toContain("suiteFetch");
      expect(secureHandler).not.toMatch(/body\.(caseFileId|srId|documentId)/);
    }
  });
});
