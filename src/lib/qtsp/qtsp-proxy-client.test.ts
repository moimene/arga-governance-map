import { describe, it, expect } from "vitest";
import {
  arrayBufferToBase64,
  buildProxySignPayload,
  invokeQTSPProxySign,
  isRealQTSPForbidden,
  normalizeProxySignResult,
} from "./qtsp-proxy-client";

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
    });
  });

  it("normalizeProxySignResult: respuesta válida → QESSignFlowResult", () => {
    const r = normalizeProxySignResult({
      srId: "SR-1",
      srStatus: "ACTIVE",
      documentId: "DOC-1",
      documentHash: "abc",
      signatoryIds: ["S1"],
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
    const r = normalizeProxySignResult({ srId: "s", documentId: "d", documentHash: "h" });
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
    const original = (import.meta as { env?: Record<string, unknown> }).env?.VITE_E2E;
    try {
      (import.meta as { env?: Record<string, unknown> }).env!.VITE_E2E = "1";
      expect(isRealQTSPForbidden()).toBe(true);
      (import.meta as { env?: Record<string, unknown> }).env!.VITE_E2E = undefined;
      expect(isRealQTSPForbidden()).toBe(false);
    } finally {
      (import.meta as { env?: Record<string, unknown> }).env!.VITE_E2E = original;
    }
  });

  it("con el cortafuegos activo, la firma cae al sandbox en vez de llamar al proveedor", async () => {
    const original = (import.meta as { env?: Record<string, unknown> }).env?.VITE_E2E;
    try {
      (import.meta as { env?: Record<string, unknown> }).env!.VITE_E2E = "1";
      const r = await invokeQTSPProxySign({
        documentName: "ACTA.pdf",
        documentData: new TextEncoder().encode("x").buffer as ArrayBuffer,
        signatories: [{ name: "A", email: "a@b.c" }],
        createdBy: "u",
      });
      // null → el caller usa el adaptador sandbox; nunca se contacta con EAD.
      expect(r).toBeNull();
    } finally {
      (import.meta as { env?: Record<string, unknown> }).env!.VITE_E2E = original;
    }
  });
});
