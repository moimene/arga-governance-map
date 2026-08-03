import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato estático de la Edge Function `qtsp-proxy`.
 *
 * La política vigente no inicia firmas: EAD Trust presta interposición,
 * mensajería y e-archiving. Las lecturas de solicitudes históricas solo sirven
 * para reconciliar expedientes source-bound preexistentes.
 */
const PROXY = resolve(process.cwd(), "supabase/functions/qtsp-proxy/index.ts");
const src = readFileSync(PROXY, "utf8");

function functionSlice(name: string, nextName?: string) {
  const start = src.indexOf(`async function ${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const end = nextName ? src.indexOf(`async function ${nextName}(`, start + 1) : src.length;
  expect(end, `${nextName ?? "EOF"} must follow ${name}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

function expectOrder(section: string, first: string, second: string) {
  const firstIndex = section.indexOf(first);
  const secondIndex = section.indexOf(second);
  expect(firstIndex, `${first} must exist`).toBeGreaterThanOrEqual(0);
  expect(secondIndex, `${second} must exist`).toBeGreaterThan(firstIndex);
}

describe("custodia EAD Trust", () => {
  it("usa identificadores idempotentes con forma UUID v4", () => {
    expect(src).toContain("async function deterministicUuid");
    expect(src).toContain("digest[6] = (digest[6] & 0x0f) | 0x40");
    expect(src).not.toContain("digest[6] = (digest[6] & 0x0f) | 0x50");
    expect(src).toContain("async function providerReference");
    expect(src).toContain("`TGMS-${(await sha256Text(normalized)).slice(0, 24)}`");
  });

  it("sube a S3 el checksum SHA-256 en base64", () => {
    expect(src).toContain("x-amz-checksum-sha256");
    expect(src).toMatch(/x-amz-checksum-sha256"\s*:\s*sha256Base64/);
  });

  it("crea evidencias FILE y verifica COMPLETED antes de responder", () => {
    const create = functionSlice("createEadEvidence", "handleEvidence");
    expect(create).toContain('evidenceType: "FILE"');
    expect(create).toContain('custodyType: "EXTERNAL"');
    expect(create).toContain('finalStatus !== "COMPLETED"');
    expect(create).toContain("verifiedAt");
  });
});

describe("acciones genéricas retiradas", () => {
  it.each([
    ["handleSign", "handleStatus"],
    ["handleStatus", "handleArtifacts"],
    ["handleArtifacts", "suiteMutationAllowConflict"],
    ["handleEvidence", "handleArchiveFinalLegalArtifact"],
  ])("%s autentica, devuelve 410 y nunca llama al proveedor", (name, nextName) => {
    const handler = functionSlice(name, nextName);
    expect(handler).toContain("authenticateEdgeRequest(req)");
    expect(handler).toContain("GENERIC_PROVIDER_ACTION_RETIRED");
    expect(handler).toContain("jsonResponse(410");
    expect(handler).not.toContain("suiteFetch(");
    expect(handler).not.toContain("createEadEvidence(");
  });

  it("no contiene iniciadores de firma ni activación de solicitudes", () => {
    expect(src).not.toContain("READY_TO_SIGN");
    expect(src).not.toContain("/activate");
    expect(src).not.toContain("addSignatory");
    expect(src).not.toContain("activateWithRetry");
  });
});

describe("reserva local antes de cualquier efecto externo", () => {
  it("rechaza el candidato browser sin reservar, crear evidencia ni registrar un final", () => {
    const handler = functionSlice("handleArchiveFinalLegalArtifact", "databaseJsonbHashSha256");
    expect(handler).toContain("AUTHORITATIVE_BINARY_REQUIRED");
    expect(handler).not.toContain("reserveEadProviderAction");
    expect(handler).not.toContain("createEadEvidence");
    expect(handler).not.toContain("fn_secretaria_register_custodied_legal_artifact");
  });

  it("reserva cada componente de cuentas antes de crear evidencia", () => {
    const handler = functionSlice(
      "handleArchiveAnnualAccountsComponentInput",
      "handleReconcileAnnualAccountsSignature",
    );
    expectOrder(handler, "reserveEadProviderAction", "createEadEvidence");
  });

  it("reserva la custodia de firma externa antes de archivar sus bytes", () => {
    const handler = functionSlice(
      "handleRecordAnnualAccountsExternalSignature",
      "handleRecordAnnualAccountsMissingCause",
    );
    expectOrder(handler, "reserveEadProviderAction", "archiveAnnualAccountsBinary");
  });

  it("rechaza la ejecución final de cuentas antes de reservar o archivar", () => {
    const handler = functionSlice("handleArchiveAnnualAccountsExecution");
    expect(handler).toContain('code: "AUTHORITATIVE_BINARY_REQUIRED"');
    expect(handler).not.toContain("reserveEadProviderAction");
    expect(handler).not.toContain("archiveAnnualAccountsBinary");
  });
});

describe("configuración", () => {
  it("lee exclusivamente los secretos server-side de EAD Suite", () => {
    expect(src).toContain("EAD_SUITE_AUTH_EMAIL");
    expect(src).toContain("EAD_SUITE_AUTH_PASSWORD");
    expect(src).not.toContain("EAD_TRUST_AUTH_EMAIL");
  });

  it("sin secretos falla cerrado y nunca simula éxito", () => {
    expect(src).toContain("QTSP_PROXY_NOT_CONFIGURED");
    expect(src).toContain("503");
    expect(src).not.toContain("simulationSuccess");
  });
});
