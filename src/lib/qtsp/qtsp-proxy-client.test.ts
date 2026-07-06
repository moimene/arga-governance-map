import { describe, it, expect } from "vitest";
import { arrayBufferToBase64, buildProxySignPayload, normalizeProxySignResult } from "./qtsp-proxy-client";

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
