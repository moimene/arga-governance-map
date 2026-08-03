import { describe, expect, it } from "vitest";
import {
  buildSignatureRequestRecord,
  normalizeSignatureRequestStatus,
} from "./signature-request-record";

describe("registro legacy de operaciones EAD por interposición", () => {
  it("registra ACTIVE como solicitud pendiente y conserva caseFileId para reconciliar", () => {
    const row = buildSignatureRequestRecord({
      tenantId: "tenant-1",
      agreementId: "agreement-77ea",
      documentType: "MODELO_ACUERDO",
      createdBy: "person-1",
      signatories: [{ name: "Lucía Paredes", email: "lucia@example.test", sequence: 1 }],
      recordedAt: "2026-07-19T10:00:00.000Z",
      result: {
        sandbox: false,
        srId: "sr-1",
        caseFileId: "case-file-1",
        srStatus: "ACTIVE",
        signatureProduced: false,
        documentId: "document-1",
        documentHash: "a".repeat(64),
        signatoryIds: ["signatory-1"],
        providerSignatureType: "INTERPOSITION",
        providerRequestedAt: "2026-07-19T09:59:00.000Z",
        providerActivatedAt: "2026-07-19T10:00:00.000Z",
        signed_at: null,
        errors: [],
      },
    });

    expect(row).toMatchObject({
      agreement_id: "agreement-77ea",
      document_type: "MODELO_ACUERDO",
      sr_status: "ACTIVE",
      evidence_status: "EAD_INTERPOSITION_REQUESTED",
      completed_at: null,
    });
    expect(row.signatories[0]).toMatchObject({
      provider_signatory_id: "signatory-1",
      case_file_id: "case-file-1",
    });
  });

  it("no eleva un estado desconocido a firma completada", () => {
    expect(
      normalizeSignatureRequestStatus({
        srStatus: "READY_TO_SIGN",
        signatureProduced: false,
      }),
    ).toBe("ACTIVE");
  });

  it("vincula una solicitud autoritativa a fuente, hash, persona, rol y autoridad", () => {
    const row = buildSignatureRequestRecord({
      tenantId: "tenant-1",
      agreementId: null,
      documentType: "ACTA",
      createdBy: "person-secretary",
      sourceDomain: "MINUTE",
      sourceId: "11111111-1111-4111-8111-111111111111",
      artifactKind: "MINUTE_FINAL",
      contentHashSha256: "c".repeat(64),
      signatories: [{
        name: "Presidenta",
        email: "presidenta@example.test",
        personId: "22222222-2222-4222-8222-222222222222",
        signerRole: "PRESIDENTE",
        authorityEvidenceId: "33333333-3333-4333-8333-333333333333",
      }],
      recordedAt: "2026-07-20T10:00:00.000Z",
      result: {
        sandbox: false,
        srId: "sr-authoritative",
        caseFileId: "case-authoritative",
        srStatus: "ACTIVE",
        signatureProduced: false,
        documentId: "document-authoritative",
        documentHash: "d".repeat(64),
        signatoryIds: ["signatory-authoritative"],
        providerSignatureType: "INTERPOSITION",
        providerRequestedAt: "2026-07-20T09:59:00.000Z",
        providerActivatedAt: "2026-07-20T10:00:00.000Z",
        signed_at: null,
        errors: [],
      },
    });

    expect(row.agreement_id).toBeNull();
    expect(row).toMatchObject({
      source_domain: "MINUTE",
      source_id: "11111111-1111-4111-8111-111111111111",
      artifact_kind: "MINUTE_FINAL",
      content_hash_sha256: "c".repeat(64),
      requested_at: "2026-07-20T09:59:00.000Z",
      activated_at: "2026-07-20T10:00:00.000Z",
    });
    expect(row.signatories[0]).toMatchObject({
      source_domain: "MINUTE",
      source_id: "11111111-1111-4111-8111-111111111111",
      artifact_kind: "MINUTE_FINAL",
      content_hash_sha256: "c".repeat(64),
      person_id: "22222222-2222-4222-8222-222222222222",
      signer_role: "PRESIDENTE",
      authority_evidence_id: "33333333-3333-4333-8333-333333333333",
      provider_signatory_id: "signatory-authoritative",
      provider_signature_type: "INTERPOSITION",
    });
  });

  it("rechaza una fuente autoritativa sin identidad/autoridad de firmante", () => {
    expect(() => buildSignatureRequestRecord({
      tenantId: "tenant-1",
      documentType: "ACTA",
      createdBy: "person-secretary",
      sourceDomain: "MINUTE",
      sourceId: "11111111-1111-4111-8111-111111111111",
      artifactKind: "MINUTE_FINAL",
      contentHashSha256: "c".repeat(64),
      signatories: [{ name: "Presidenta", email: "presidenta@example.test" }],
      recordedAt: "2026-07-20T10:00:00.000Z",
      result: {
        srId: "sr-authoritative",
        caseFileId: "case-authoritative",
        srStatus: "ACTIVE",
        signatureProduced: false,
        documentId: "document-authoritative",
        documentHash: "d".repeat(64),
        signatoryIds: ["signatory-authoritative"],
        providerSignatureType: "INTERPOSITION",
        providerRequestedAt: "2026-07-20T09:59:00.000Z",
        signed_at: null,
        errors: [],
      },
    })).toThrow(/autoridad persistida/i);
  });

  it("vincula cuentas anuales al set WORM y al roster de administradores", () => {
    const row = buildSignatureRequestRecord({
      tenantId: "tenant-1",
      documentType: "CUENTAS_ANUALES_EJECUCION",
      createdBy: "person-secretary",
      sourceDomain: "ANNUAL_ACCOUNTS",
      sourceId: "11111111-1111-4111-8111-111111111111",
      artifactKind: "ANNUAL_ACCOUNTS_EXECUTION",
      contentHashSha256: "c".repeat(64),
      signatories: [{
        name: "Administradora",
        email: "admin@example.test",
        personId: "22222222-2222-4222-8222-222222222222",
        signerRole: "ADMINISTRADOR",
      }],
      recordedAt: "2026-07-20T10:00:00.000Z",
      result: {
        sandbox: false,
        srId: "sr-annual",
        caseFileId: "case-annual",
        srStatus: "ACTIVE",
        signatureProduced: false,
        documentId: "document-annual",
        documentHash: "d".repeat(64),
        signatoryIds: ["signatory-annual"],
        providerSignatureType: "INTERPOSITION",
        providerRequestedAt: "2026-07-20T09:59:00.000Z",
        signed_at: null,
        errors: [],
      },
    });

    expect(row).toMatchObject({
      source_domain: "ANNUAL_ACCOUNTS",
      source_id: "11111111-1111-4111-8111-111111111111",
      artifact_kind: "ANNUAL_ACCOUNTS_EXECUTION",
      content_hash_sha256: "c".repeat(64),
    });
    expect(row.signatories[0]).toMatchObject({
      signer_role: "ADMINISTRADOR",
      authority_evidence_id: null,
      provider_signature_type: "INTERPOSITION",
    });
  });

  it("separa una simulación sandbox de cualquier efecto real aunque simule COMPLETED", () => {
    const row = buildSignatureRequestRecord({
      tenantId: "tenant-1",
      agreementId: "agreement-77ea",
      documentType: "MODELO_ACUERDO",
      createdBy: "person-1",
      signatories: [{ name: "Lucía Paredes", email: "lucia@example.test" }],
      recordedAt: "2026-07-19T10:00:00.000Z",
      result: {
        sandbox: true,
        srId: "SR-SANDBOX-1",
        srStatus: "COMPLETED",
        signatureProduced: true,
        documentId: "DOC-SANDBOX-1",
        documentHash: "b".repeat(64),
        signatoryIds: ["SIGN-SANDBOX-1"],
        signed_at: "2026-07-19T10:00:00.000Z",
        errors: [],
      },
    });

    expect(row.sr_status).toBe("COMPLETED");
    expect(row.evidence_status).toBe("SANDBOX_DEMO_NO_PROVIDER_EFFECT");
  });
});
