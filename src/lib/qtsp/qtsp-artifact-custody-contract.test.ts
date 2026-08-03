import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  archiveFinalLegalArtifactWithEADTrust,
  buildFinalLegalArtifactArchivePayload,
  normalizeFinalLegalArtifactArchiveResult,
} from "./qtsp-proxy-client";

const SHA256 = "a".repeat(64);

function historicalValidResult() {
  return {
    provider: "EAD_TRUST",
    providerName: "EAD Trust",
    service: "EVIDENCE_MANAGER",
    providerMode: "INTERPOSITION",
    custodyMode: "EARCHIVE",
    signatureClaim: false,
    status: "FINAL_IMMUTABLE",
    artifactRole: "CUSTODIED_BINARY",
    sourceDomain: "MINUTE",
    sourceId: "11111111-1111-4111-8111-111111111111",
    artifactKind: "MINUTE_FINAL",
    legalArtifactId: "22222222-2222-4222-8222-222222222222",
    evidenceBundleId: "33333333-3333-4333-8333-333333333333",
    eadCaseFileId: "44444444-4444-4444-8444-444444444444",
    eadEvidenceGroupId: "55555555-5555-4555-8555-555555555555",
    eadEvidenceId: "66666666-6666-4666-8666-666666666666",
    providerActionReservationId: "77777777-7777-4777-8777-777777777777",
    contentHashSha256: SHA256,
    binaryHashSha256: "b".repeat(64),
    binaryHashSha512: "c".repeat(128),
    evidenceManifestHash: "d".repeat(64),
    storagePath: "tenant/secretaria/minute/source/final.pdf",
    reused: false,
  };
}

describe("cliente de custodia legal EAD Trust", () => {
  it("el payload del navegador nunca contiene bytes ni metadatos de archivo", () => {
    const payload = buildFinalLegalArtifactArchivePayload({
      sourceDomain: "MINUTE",
      sourceId: "11111111-1111-4111-8111-111111111111",
      artifactKind: "MINUTE_FINAL",
      contentHash: SHA256,
    });

    expect(payload).toEqual({
      action: "archive_final_legal_artifact",
      sourceDomain: "MINUTE",
      sourceId: "11111111-1111-4111-8111-111111111111",
      artifactKind: "MINUTE_FINAL",
      contentHash: SHA256,
    });
    expect(payload).not.toHaveProperty("documentBase64");
    expect(payload).not.toHaveProperty("fileName");
    expect(payload).not.toHaveProperty("mimeType");
  });

  it("falla cerrado antes de invocar el proxy, incluso fuera de E2E", async () => {
    await expect(
      archiveFinalLegalArtifactWithEADTrust({
        sourceDomain: "CERTIFICATION",
        sourceId: "11111111-1111-4111-8111-111111111111",
        artifactKind: "CERTIFICATION_FINAL",
        contentHash: SHA256,
      }),
    ).rejects.toThrow("AUTHORITATIVE_BINARY_REQUIRED");
  });

  it("mantiene lectura estricta de respuestas históricas sin crear nuevas", () => {
    const result = historicalValidResult();
    expect(normalizeFinalLegalArtifactArchiveResult(result)).toEqual(result);
    expect(normalizeFinalLegalArtifactArchiveResult({ ...result, provider: "OTRO" })).toBeNull();
  });
});

describe("trust boundary de archive_final_legal_artifact", () => {
  const source = readFileSync(
    resolve(process.cwd(), "supabase/functions/qtsp-proxy/index.ts"),
    "utf8",
  );
  const start = source.indexOf("async function handleArchiveFinalLegalArtifact");
  const end = source.indexOf("// ─── Compatibilidad histórica", start);
  const handler = source.slice(start, end);

  it("autentica y rechaza antes de leer bytes, contactar EAD o registrar un final", () => {
    const rejection = handler.indexOf('code: "AUTHORITATIVE_BINARY_REQUIRED"');
    expect(handler).toContain("authenticateEdgeRequest(req)");
    expect(rejection).toBeGreaterThanOrEqual(0);
    expect(handler).not.toContain("documentBase64");
    expect(handler).not.toContain("createEadEvidence(");
    expect(handler).not.toContain("fn_secretaria_register_custodied_legal_artifact");
    expect(handler).toContain("finalArtifactCreated: false");
  });

  it("explica la condición necesaria sin fabricar firma ni evidencia sandbox", () => {
    expect(handler).toContain("binario generado y registrado de forma autoritativa en servidor");
    expect(handler).toContain('providerMode: "INTERPOSITION"');
    expect(handler).toContain("signatureClaim: false");
    expect(handler).not.toContain("handleSign(");
  });
});
