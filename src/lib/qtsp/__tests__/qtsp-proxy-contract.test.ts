import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato de la Edge Function `qtsp-proxy`.
 *
 * Corre en Deno y no se puede importar desde la suite, así que se fija sobre el
 * fuente. No es cosmética: cada una de estas comprobaciones corresponde a una
 * trampa verificada en producción del proveedor, y perder cualquiera de ellas
 * vuelve a romper la integración de un modo que los tests unitarios no ven.
 */
const PROXY = resolve(process.cwd(), "supabase/functions/qtsp-proxy/index.ts");
const src = readFileSync(PROXY, "utf8");

describe("identidad y subida de documentos", () => {
  it("los ids son UUID v4 generados por cliente", () => {
    // EAD rechaza UUID v5 con {"errors":{"id":[{"error":"isUuid"}]}}.
    expect(src).toContain("crypto.randomUUID()");
    expect(src).not.toMatch(/uuidv5|v5\(/i);
  });

  it("la subida a S3 lleva el checksum en base64, no en hexadecimal", () => {
    // La URL prefirmada se firma con SignedHeaders=host;x-amz-checksum-sha256.
    // Omitir la cabecera, o mandar el hex, da 403 SignatureDoesNotMatch.
    expect(src).toContain("x-amz-checksum-sha256");
    expect(src).toMatch(/x-amz-checksum-sha256"\s*:\s*sha256Base64/);
  });

  it("espera a READY_TO_SIGN antes de activar", () => {
    // El procesado es asíncrono; activar antes falla.
    expect(src).toContain("READY_TO_SIGN");
  });
});

describe("coordenadas de firma", () => {
  it("solo {page,x,y}, sin caja y nunca con página negativa", () => {
    // page:-1 o enviar width/height hace que la activación devuelva 400.
    expect(src).toMatch(/coordinates:\s*\[\{\s*page:\s*signaturePage/);
    expect(src).not.toMatch(/page:\s*-1/);
    expect(src).not.toMatch(/coordinates[\s\S]{0,160}width:/);
  });

  it("la página del sello la decide el generador del PDF, no está fijada a 1", () => {
    // Codex adversarial: fijar página 1 a ciegas colocaba la firma sobre el
    // cuerpo del acuerdo en documentos de varias páginas.
    expect(src).toContain("const signaturePage = Math.max(1, Math.trunc(Number(body.signaturePage) || 1));");
    expect(src).not.toMatch(/coordinates:\s*\[\{\s*page:\s*1\s*,/);
  });

  it("el signatoryId se LEE del documento, no se asume igual al participante", () => {
    expect(src).toContain("/signatories");
  });
});

describe("activación: la carrera contra la paginación asíncrona", () => {
  it("reintenta con espera creciente", () => {
    expect(src).toContain("ACTIVATE_RETRY_DELAYS_MS");
    expect(src).toMatch(/ACTIVATE_RETRY_DELAYS_MS\s*=\s*\[0,\s*2000,\s*5000,\s*10000\]/);
  });

  it("SONDEA antes de reintentar: la activación puede haber triunfado en servidor", () => {
    // Reactivar a ciegas duplicaría la solicitud.
    expect(src).toContain("readSignatureRequestStatus");
    expect(src).toMatch(/status !== "DRAFT"/);
  });

  it("devuelve el estado REAL del proveedor, no un literal optimista", () => {
    // Antes se devolvía srStatus:"ACTIVE" a mano tras activar.
    expect(src).not.toMatch(/srStatus:\s*"ACTIVE"/);
    expect(src).toContain("const srStatus = await activateWithRetry(");
  });

  it("si no se puede leer el estado NO se inventa ACTIVE", () => {
    // Codex adversarial: `?? "ACTIVE"` colaba un estado optimista cuando la
    // activación iba bien pero la consulta posterior fallaba. UNKNOWN nunca
    // acredita firma, que es la respuesta segura.
    expect(src).not.toMatch(/\?\?\s*"ACTIVE"/);
    expect(src).toMatch(/\?\?\s*"UNKNOWN"/);
  });
});

describe("acción artifacts: los dos artefactos de una firma", () => {
  it("está enrutada y valida sus identificadores", () => {
    expect(src).toContain('case "artifacts"');
    expect(src).toContain("caseFileId, srId y documentId son obligatorios");
  });

  it("pide el documento firmado por REST: el MCP no lo entrega", () => {
    expect(src).toContain("signed-document-url");
  });

  it("pide también el certificado, que es OTRO artefacto", () => {
    // El certificado es la hoja de firmas y NO contiene el texto del acuerdo.
    // Guardar solo ese y llamarlo contrato firmado es un defecto legal.
    expect(src).toContain("certificates/document-url");
    expect(src).toContain("certificates/package-url");
  });

  it("cada artefacto es independiente: uno que falle no tumba al otro", () => {
    expect(src).toContain("signedDocumentError");
    expect(src).toContain("certificateError");
  });

  it("no asume un único nombre de campo en la respuesta", () => {
    // El nombre cambia por endpoint: signedDocumentUrl / documentUrl / packageUrl.
    expect(src).toMatch(/pick\([\s\S]{0,80}"signedDocumentUrl",\s*"url"\)/);
    expect(src).toMatch(/pick\([\s\S]{0,80}"documentUrl",\s*"url"\)/);
  });
});

describe("nivel de firma", () => {
  it("emite INTERPOSITION y en ningún caso afirma tipo cualificado", () => {
    // El proveedor no expone QES: su techo es ADVANCED.
    expect(src).toContain('signatureType: "INTERPOSITION"');
    expect(src).not.toMatch(/signatureType:\s*"QUALIFIED"/);
  });
});

describe("configuración", () => {
  it("lee los secretos EAD_SUITE_*, que son los provisionados", () => {
    // La documentación pedía EAD_TRUST_*, que el código ignora desde el proxy v2.
    expect(src).toContain("EAD_SUITE_AUTH_EMAIL");
    expect(src).toContain("EAD_SUITE_AUTH_PASSWORD");
    expect(src).not.toContain("EAD_TRUST_AUTH_EMAIL");
  });

  it("sin secretos responde 503 y no simula una firma", () => {
    expect(src).toContain("QTSP_PROXY_NOT_CONFIGURED");
    expect(src).toContain("503");
  });
});
