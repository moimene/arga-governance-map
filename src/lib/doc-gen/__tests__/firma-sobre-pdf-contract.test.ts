import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato histórico del antiguo camino de firma sobre PDF.
 *
 * El producto ya no inicia firma personal. Este test conserva el nombre del
 * archivo para impedir que una regresión reactive aquel camino y separa tres
 * hechos: generación del borrador, copia de trabajo y custodia EAD source-bound.
 */
function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const STEPPER = "src/pages/secretaria/GenerarDocumentoStepper.tsx";
const PROXY = "supabase/functions/qtsp-proxy/index.ts";
const SIGN_HOOK = "src/hooks/useQTSPSign.ts";

describe("el generador no inicia firma personal", () => {
  const stepper = read(STEPPER);

  it("no importa ni ejecuta el adaptador genérico de firma", () => {
    expect(stepper).not.toContain("useQTSPSign");
    expect(stepper).not.toContain("signMutation");
    expect(stepper).not.toContain("providerSignatureType");
    expect(stepper).not.toContain("signatureAnchor");
    expect(stepper).not.toContain("signedDocumentData");
  });

  it("presenta la custodia final como una acción exclusiva del expediente", () => {
    expect(stepper).toMatch(/Custodia EAD Trust/);
    expect(stepper).toMatch(/expediente autoritativo/);
    expect(stepper).toMatch(/no atribuye ni sustituye firma, consentimiento o causa legal/);
    expect(stepper).toMatch(/Custodia disponible desde expediente/);
  });
});

describe("la copia de trabajo conserva exactamente el DOCX generado", () => {
  const stepper = read(STEPPER);

  it("archiva los bytes del DOCX y mantiene su extensión", () => {
    expect(stepper).toMatch(/\.replace\(\/\\\.docx\$\/i, ""\) \+ "\.docx"/);
    expect(stepper).toMatch(/const archiveBuffer = docxBuffer\.buffer\.slice\(/);
    expect(stepper).toContain('archivedBufferKind: "ORIGINAL_DOCX"');
  });

  it("no adjunta referencias EAD ni rotula la copia como output del proveedor", () => {
    expect(stepper).not.toContain("eadInterpositionRequestId");
    expect(stepper).not.toContain("eadInterpositionStatus");
    expect(stepper).not.toContain("eadDocumentId");
    expect(stepper).not.toContain("eadParticipantIds");
    expect(stepper).not.toContain("QTSP_SIGNED_PDF");
    expect(stepper).not.toContain("QTSP_SIGNED_DOCX");
  });
});

describe("la custodia EAD final queda cerrada hasta existir renderer autoritativo", () => {
  const proxy = read(PROXY);

  it("retira las acciones genéricas y rechaza el candidato del navegador", () => {
    expect(proxy).toContain("GENERIC_PROVIDER_ACTION_RETIRED");
    expect(proxy).toContain('body.action === "archive_final_legal_artifact"');
    expect(proxy).toContain('code: "AUTHORITATIVE_BINARY_REQUIRED"');
    expect(proxy).toContain("un candidato del navegador no puede convertirse en artefacto legal final");
  });

  it("no conserva implementación alguna que lea o eleve bytes del navegador", () => {
    const start = proxy.indexOf("async function handleArchiveFinalLegalArtifact");
    const end = proxy.indexOf("// ─── Compatibilidad histórica", start);
    const handler = proxy.slice(start, end);
    expect(handler).toContain('code: "AUTHORITATIVE_BINARY_REQUIRED"');
    expect(handler).not.toContain("documentBase64");
    expect(handler).not.toContain("createEadEvidence(");
    expect(handler).not.toContain("fn_secretaria_register_custodied_legal_artifact");
  });
});

describe("los adaptadores legacy fallan cerrados", () => {
  const hook = read(SIGN_HOOK);

  it("la firma y la mensajería genéricas siempre terminan en error controlado", () => {
    expect(hook).toMatch(/throw new Error\(RETIRED_SIGN_MESSAGE\)/);
    expect(hook).toMatch(/throw new Error\(CONTROLLED_MESSAGE\)/);
    expect(hook).toContain("signed_at: null;");
    expect(hook).toContain("signatureProduced?: false;");
    expect(hook).not.toMatch(/signed_at:\s*new Date\(/);
  });
});
