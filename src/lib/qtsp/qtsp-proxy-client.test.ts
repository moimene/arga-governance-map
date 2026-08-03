import { describe, it, expect } from "vitest";
import {
  arrayBufferToBase64,
  buildProxySignPayload,
  buildVerifiedEADSignatureReconciliationPayload,
  edgeFunctionErrorDetail,
  invokeQTSPProxySign,
  isRealQTSPForbidden,
  normalizeProxySignResult,
  normalizeVerifiedEADSignatureReconciliationResult,
} from "./qtsp-proxy-client";

describe("qtsp-proxy-client — errores HTTP explicables", () => {
  it("lee el JSON del Response conservado por FunctionsHttpError", async () => {
    const context = new Response(
      JSON.stringify({ error: "Evidence Manager rechazó el fichero", detail: "hash no verificado" }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
    await expect(
      edgeFunctionErrorDetail(null, { message: "Edge Function returned a non-2xx status code", context }),
    ).resolves.toBe("Evidence Manager rechazó el fichero · hash no verificado");
  });

  it("prioriza el cuerpo ya parseado y conserva fallback del transporte", async () => {
    await expect(
      edgeFunctionErrorDetail({ error: "Acceso denegado" }, { message: "genérico" }),
    ).resolves.toBe("Acceso denegado");
    await expect(edgeFunctionErrorDetail(null, { message: "genérico" })).resolves.toBe("genérico");
  });
});

// Integración QTSP real vía Edge Function `qtsp-proxy` (server-side, Okta
// client_credentials). Estos helpers son la parte pura del cliente browser.
describe("qtsp-proxy-client (helpers puros)", () => {
  it("arrayBufferToBase64: vectores conocidos", () => {
    expect(arrayBufferToBase64(new TextEncoder().encode("hola").buffer as ArrayBuffer)).toBe("aG9sYQ==");
    expect(arrayBufferToBase64(new Uint8Array([]).buffer as ArrayBuffer)).toBe("");
    expect(arrayBufferToBase64(new Uint8Array([0, 255, 128]).buffer as ArrayBuffer)).toBe("AP+A");
  });

  it("arrayBufferToBase64: buffer grande (chunked, no revienta la pila)", () => {
    const big = new Uint8Array(1_000_000); // 1MB de ceros
    const b64 = arrayBufferToBase64(big.buffer as ArrayBuffer);
    // 1MB → ~1.33MB base64; validamos longitud y decodificación de una muestra
    expect(b64.length).toBeGreaterThan(1_300_000);
    expect(atob(b64.slice(0, 4))).toBe("\x00\x00\x00");
  });

  it("buildProxySignPayload: forma completa con base64 y firmantes", () => {
    const data = new TextEncoder().encode("doc").buffer as ArrayBuffer;
    const payload = buildProxySignPayload({
      documentName: "ACTA-1.docx",
      documentData: data,
      signatories: [{ name: "Lucía", email: "l@x.com", sequence: 1 }],
      createdBy: "person-1",
      agreementId: "agr-1",
    });
    expect(payload).toMatchObject({
      action: "sign",
      documentName: "ACTA-1.docx",
      documentBase64: "ZG9j",
      signatories: [{ name: "Lucía", email: "l@x.com", sequence: 1 }],
      createdBy: "person-1",
      agreementId: "agr-1",
      providerSignatureType: "INTERPOSITION",
    });
  });

  it("buildProxySignPayload no filtra IDs jurídicos internos al proveedor", () => {
    const payload = buildProxySignPayload({
      documentName: "ACTA.pdf",
      documentData: new Uint8Array([1]).buffer,
      signatories: [{
        name: "Presidenta",
        email: "presidenta@example.test",
        personId: "person-interno",
        signerRole: "PRESIDENTE",
        authorityEvidenceId: "authority-interna",
      }],
      createdBy: "secretaria",
    });
    expect(payload.signatories[0]).toEqual({
      name: "Presidenta",
      email: "presidenta@example.test",
    });
    expect(payload.signatories[0]).not.toHaveProperty("personId");
    expect(payload.signatories[0]).not.toHaveProperty("authorityEvidenceId");
  });

  it("no filtra al proveedor los identificadores jurídicos internos del firmante", () => {
    const payload = buildProxySignPayload({
      documentName: "ACTA-1.pdf",
      documentData: new TextEncoder().encode("doc").buffer as ArrayBuffer,
      signatories: [{
        name: "Lucía",
        email: "l@x.com",
        personId: "person-internal",
        signerRole: "SECRETARIO",
        authorityEvidenceId: "authority-internal",
      }],
      createdBy: "person-1",
    });
    expect(payload.signatories).toEqual([{ name: "Lucía", email: "l@x.com" }]);
    expect(JSON.stringify(payload)).not.toContain("person-internal");
    expect(JSON.stringify(payload)).not.toContain("authority-internal");
  });

  it("normalizeProxySignResult: respuesta válida → EADSignFlowResult", () => {
    const r = normalizeProxySignResult({
      srId: "SR-1",
      srStatus: "ACTIVE",
      documentId: "DOC-1",
      documentHash: "abc",
      signatoryIds: ["S1"],
      providerSignatureType: "INTERPOSITION",
      providerRequestedAt: "2026-07-20T09:00:00.000Z",
    });
    expect(r).toMatchObject({ srId: "SR-1", documentId: "DOC-1", documentHash: "abc", signatoryIds: ["S1"] });
  });

  it("normalizeProxySignResult: respuesta sin srId → null (no se finge éxito)", () => {
    expect(normalizeProxySignResult({ ok: true })).toBeNull();
    expect(normalizeProxySignResult(null)).toBeNull();
    expect(normalizeProxySignResult("error")).toBeNull();
  });
});

// ─── Reconciliación: lo que el cliente conserva del proveedor ────────────────
//
// El `caseFileId` se descartaba, y sin él no se puede consultar el estado ni
// recuperar el documento firmado: ambos endpoints lo llevan en la ruta. Como EAD
// no emite webhooks, perderlo dejaba el ciclo de firma abierto para siempre.
describe("normalizeProxySignResult — conserva lo que permite cerrar el ciclo", () => {
  const base = {
    srId: "sr-1",
    documentId: "doc-1",
    documentHash: "abc",
    signatoryIds: ["sig-1"],
    providerSignatureType: "INTERPOSITION",
    providerRequestedAt: "2026-07-20T09:00:00.000Z",
  };

  it("conserva el caseFileId devuelto por el proxy", () => {
    const r = normalizeProxySignResult({ ...base, caseFileId: "cf-1", srStatus: "ACTIVE" });
    expect(r?.caseFileId).toBe("cf-1");
  });

  it("conserva el estado REAL del proveedor, no uno inventado", () => {
    expect(normalizeProxySignResult({ ...base, srStatus: "COMPLETED" })?.srStatus).toBe("COMPLETED");
    expect(normalizeProxySignResult({ ...base, srStatus: "PARTIALLY_SIGNED" })?.srStatus).toBe(
      "PARTIALLY_SIGNED",
    );
  });

  it("sin estado asume ACTIVE, que es 'solicitada', nunca 'firmada'", () => {
    // El defecto por omisión debe ser el conservador: si no sabemos, no está firmado.
    expect(normalizeProxySignResult(base)?.srStatus).toBe("ACTIVE");
  });

  it("un caseFileId ausente o de tipo raro no se inventa", () => {
    expect(normalizeProxySignResult(base)?.caseFileId).toBeUndefined();
    expect(normalizeProxySignResult({ ...base, caseFileId: 42 })?.caseFileId).toBeUndefined();
  });

  it("rechaza respuestas sin los identificadores mínimos", () => {
    expect(normalizeProxySignResult({ srId: "sr-1" })).toBeNull();
    expect(normalizeProxySignResult(null)).toBeNull();
    expect(normalizeProxySignResult("texto")).toBeNull();
  });
});

describe("normalizeProxySignResult — respuestas hostiles del transporte", () => {
  it("un 2xx con cuerpo no-objeto no revienta: devuelve null", () => {
    // Nunca se confía en la forma del cuerpo aunque el status sea 2xx.
    expect(normalizeProxySignResult(42)).toBeNull();
    expect(normalizeProxySignResult([])).toBeNull();
    expect(normalizeProxySignResult(undefined)).toBeNull();
    expect(normalizeProxySignResult(true)).toBeNull();
  });

  it("identificadores del tipo equivocado se rechazan, no se coaccionan", () => {
    expect(normalizeProxySignResult({ srId: 1, documentId: "d", documentHash: "h" })).toBeNull();
    expect(normalizeProxySignResult({ srId: "s", documentId: null, documentHash: "h" })).toBeNull();
  });

  it("signatoryIds ausente no invalida la respuesta: se normaliza a lista vacía", () => {
    const r = normalizeProxySignResult({
      srId: "s",
      documentId: "d",
      documentHash: "h",
      providerSignatureType: "INTERPOSITION",
      providerRequestedAt: "2026-07-20T09:00:00.000Z",
    });
    expect(r?.signatoryIds).toEqual([]);
  });
});

describe("cortafuegos: una prueba no puede firmar de verdad", () => {
  it("bajo e2e se prohíbe el QTSP real", () => {
    // Hallazgo grave: las pruebas apuntan al Supabase de Cloud, donde el proxy
    // está desplegado y con credenciales. Cada ejecución creaba solicitudes de
    // firma REALES en EAD Trust, con expediente y aviso al firmante, por el mero
    // hecho de pasar un test. Una batería de pruebas no puede tener efectos
    // jurídicos en un proveedor externo.
    expect(isRealQTSPForbidden({ VITE_E2E: "1" })).toBe(true);
    expect(isRealQTSPForbidden({ VITE_E2E: true })).toBe(true);
    expect(isRealQTSPForbidden({})).toBe(false);
  });

  it("la firma genérica está retirada incluso con cortafuegos y no cae a un falso sandbox", async () => {
    await expect(invokeQTSPProxySign(
      {
        documentName: "ACTA.pdf",
        documentData: new TextEncoder().encode("x").buffer as ArrayBuffer,
        signatories: [{ name: "A", email: "a@b.c" }],
        createdBy: "u",
      },
      undefined,
      { forbidRealQTSP: true },
    )).rejects.toThrow(/firma electrónica genérica está retirada/i);
  });
});

describe("contrato cliente de reconciliación autoritativa", () => {
  const input = {
    signatureRequestId: "11111111-1111-4111-8111-111111111111",
    sourceDomain: "MINUTE" as const,
    sourceId: "22222222-2222-4222-8222-222222222222",
    artifactKind: "MINUTE_FINAL" as const,
    contentHash: "a".repeat(64),
    fileName: "acta-firmada.pdf",
  };

  it("solo envía el UUID interno y la fuente canónica; nunca IDs EAD arbitrarios", () => {
    expect(buildVerifiedEADSignatureReconciliationPayload(input)).toEqual({
      action: "reconcile_verified_signature",
      ...input,
    });
    expect(buildVerifiedEADSignatureReconciliationPayload(input)).not.toHaveProperty("caseFileId");
    expect(buildVerifiedEADSignatureReconciliationPayload(input)).not.toHaveProperty("srId");
    expect(buildVerifiedEADSignatureReconciliationPayload(input)).not.toHaveProperty("documentId");
    expect(buildVerifiedEADSignatureReconciliationPayload(input)).not.toHaveProperty("documentBase64");
  });

  it("valida custodia, cronología y evidencias individuales sin claim de firma", () => {
    const result = {
      provider: "EAD_TRUST",
      providerName: "EAD Trust",
      service: "EVIDENCE_MANAGER",
      providerMode: "INTERPOSITION",
      signatureClaim: false,
      status: "VERIFIED",
      artifactRole: "CUSTODIED_BINARY",
      sourceDomain: "MINUTE",
      sourceId: input.sourceId,
      artifactKind: "MINUTE_FINAL",
      signatureRequestId: input.signatureRequestId,
      providerRequestId: "ead-sr-1",
      providerDocumentId: "ead-doc-1",
      providerStatus: "COMPLETED",
      providerRequestedAt: "2025-07-20T09:00:00.000Z",
      providerCompletedAt: "2025-07-20T10:00:00.000Z",
      requestInputHashSha256: "b".repeat(64),
      custodiedBinaryHashSha256: "c".repeat(64),
      custodiedBinaryHashSha512: "d".repeat(128),
      legalArtifactId: "33333333-3333-4333-8333-333333333333",
      custodyEvidenceBundleId: "44444444-4444-4444-8444-444444444444",
      custodyEvidenceId: "55555555-5555-4555-8555-555555555555",
      storagePath: "tenant/secretaria/minute/custodied.pdf",
      completionEvidenceDocumentRef: "https://ead/evidence",
      completionEvidencePackageRef: "https://ead/package",
      completionEvidenceFingerprintSha256: "e".repeat(64),
      completionPackageFingerprintSha256: "f".repeat(64),
      interpositionEvidences: [{
        signerRole: "PRESIDENTE",
        subjectPersonId: "66666666-6666-4666-8666-666666666666",
        providerSignatoryId: "ead-signer-1",
        evidencePurpose: "CONSENT",
        evidenceId: "77777777-7777-4777-8777-777777777777",
      }],
      reusedCustody: false,
    };
    expect(normalizeVerifiedEADSignatureReconciliationResult(result)).toEqual(result);
    expect(normalizeVerifiedEADSignatureReconciliationResult({
      ...result,
      providerSignatureType: "INTERPOSITION",
    })).toBeNull();
    expect(normalizeVerifiedEADSignatureReconciliationResult({
      ...result,
      providerRequestedAt: "2025-07-20T11:00:00.000Z",
    })).toBeNull();
    expect(normalizeVerifiedEADSignatureReconciliationResult({
      ...result,
      interpositionEvidences: [{
        ...result.interpositionEvidences[0],
        evidencePurpose: "CONSTANCIA",
      }],
    })).toBeNull();
  });
});
