import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realProxyModule from "@/lib/qtsp/qtsp-proxy-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * EAD **no emite webhooks**: sin reconciliar, un expediente se queda en "firma
 * solicitada" para siempre aunque los firmantes ya hayan firmado. Este hook es
 * el único camino que cierra el ciclo, así que su comportamiento se fija aquí.
 *
 * Reglas que se prueban:
 *  · los artefactos SOLO se piden cuando la firma está completada (los endpoints
 *    fallan antes, y pedirlos solo produce ruido);
 *  · cada artefacto es independiente: que falle el certificado no puede impedir
 *    recuperar el documento firmado, que es el que contiene el acuerdo;
 *  · si el proxy no está desplegado, se informa sin romper.
 */

const estado = vi.fn();
const artefactos = vi.fn();

const __realModules: Array<[string, Record<string, unknown>]> = [
  ["@/lib/qtsp/qtsp-proxy-client", { ...__realProxyModule }],
];
__afterAllRestore(() => {
  for (const [spec, exports] of __realModules) {
    __bunMockRestore.module(spec, () => exports);
  }
});

vi.mock("@/lib/qtsp/qtsp-proxy-client", () => ({
  fetchQTSPSignatureStatus: (...a: unknown[]) => estado(...a),
  fetchQTSPSignatureArtifacts: (...a: unknown[]) => artefactos(...a),
}));

const { useQTSPReconcile } = await import("../useQTSPReconcile");

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const IDS = { caseFileId: "cf-1", srId: "sr-1", documentId: "doc-1" };

async function reconciliar() {
  const { result } = renderHook(() => useQTSPReconcile(), { wrapper });
  result.current.mutate(IDS);
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current;
}

beforeEach(() => {
  estado.mockReset();
  artefactos.mockReset();
});

describe("useQTSPReconcile", () => {
  it("ACTIVE es solicitud: no se piden artefactos", async () => {
    estado.mockResolvedValue({ status: "ACTIVE", documents: [] });
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("SOLICITADA");
    expect(r.data?.outcomeLabel).toBe("Firma solicitada — pendiente de firma");
    expect(r.data?.artifacts).toBeNull();
    expect(artefactos).not.toHaveBeenCalled();
  });

  it("PARTIALLY_SIGNED tampoco basta: faltan firmantes", async () => {
    estado.mockResolvedValue({ status: "PARTIALLY_SIGNED", documents: [] });
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("PARCIAL");
    expect(artefactos).not.toHaveBeenCalled();
  });

  it("COMPLETED recupera los DOS artefactos", async () => {
    estado.mockResolvedValue({ status: "COMPLETED", documents: [] });
    artefactos.mockResolvedValue({
      signedDocumentUrl: "https://ead/firmado.pdf",
      signedDocumentError: null,
      certificateUrl: "https://ead/certificado.pdf",
      certificateError: null,
      certificatePackageUrl: "https://ead/paquete.zip",
    });
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("COMPLETADA");
    // El documento firmado es el que contiene el acuerdo; el certificado
    // acredita el proceso pero NO lleva el texto. Hacen falta los dos.
    expect(r.data?.artifacts?.signedDocumentUrl).toBe("https://ead/firmado.pdf");
    expect(r.data?.artifacts?.certificateUrl).toBe("https://ead/certificado.pdf");
    expect(r.data?.avisos).toEqual([]);
    expect(artefactos).toHaveBeenCalledWith("cf-1", "sr-1", "doc-1");
  });

  it("un artefacto que falla no impide recuperar el otro", async () => {
    estado.mockResolvedValue({ status: "COMPLETED", documents: [] });
    artefactos.mockResolvedValue({
      signedDocumentUrl: "https://ead/firmado.pdf",
      signedDocumentError: null,
      certificateUrl: null,
      certificateError: "403 Forbidden",
      certificatePackageUrl: null,
    });
    const r = await reconciliar();
    expect(r.data?.artifacts?.signedDocumentUrl).toBe("https://ead/firmado.pdf");
    expect(r.data?.avisos).toHaveLength(1);
    expect(r.data?.avisos[0]).toContain("Certificado no recuperado");
  });

  it("si falla el documento firmado se avisa, y sigue sin ser fatal", async () => {
    estado.mockResolvedValue({ status: "COMPLETED", documents: [] });
    artefactos.mockResolvedValue({
      signedDocumentUrl: null,
      signedDocumentError: "aún no disponible",
      certificateUrl: "https://ead/certificado.pdf",
      certificateError: null,
      certificatePackageUrl: null,
    });
    const r = await reconciliar();
    expect(r.data?.avisos[0]).toContain("Documento firmado no recuperado");
    expect(r.data?.artifacts?.certificateUrl).toBe("https://ead/certificado.pdf");
  });

  it("proxy no desplegado: se informa sin romper el flujo", async () => {
    estado.mockResolvedValue(null);
    const r = await reconciliar();
    expect(r.data?.disponible).toBe(false);
    expect(r.data?.providerStatus).toBeNull();
    expect(artefactos).not.toHaveBeenCalled();
  });

  it("una solicitud anulada no acredita firma", async () => {
    estado.mockResolvedValue({ status: "CANCELLED", documents: [] });
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("SIN_EFECTO");
    expect(artefactos).not.toHaveBeenCalled();
  });
});

describe("respuestas incompletas del proveedor (Codex adversarial)", () => {
  it("COMPLETED sin artefactos no se queda callado", async () => {
    // Un 2xx sin URLs dejaba el expediente como firmado y sin documento, sin
    // que nadie se enterara.
    estado.mockResolvedValue({ status: "COMPLETED", documents: [] });
    artefactos.mockResolvedValue(null);
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("COMPLETADA");
    expect(r.data?.artifacts).toBeNull();
    expect(r.data?.avisos.length).toBeGreaterThan(0);
  });

  it("COMPLETED con ambas URL nulas y sin error tampoco pasa en silencio", async () => {
    estado.mockResolvedValue({ status: "COMPLETED", documents: [] });
    artefactos.mockResolvedValue({
      signedDocumentUrl: null,
      signedDocumentError: null,
      certificateUrl: null,
      certificateError: null,
      certificatePackageUrl: null,
    });
    const r = await reconciliar();
    expect(r.data?.avisos.length).toBeGreaterThan(0);
  });

  it("un estado desconocido del proveedor no acredita firma", async () => {
    // El proxy devuelve UNKNOWN cuando activó pero no pudo leer el estado.
    estado.mockResolvedValue({ status: "UNKNOWN", documents: [] });
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("SOLICITADA");
    expect(artefactos).not.toHaveBeenCalled();
  });

  it("un cuerpo 2xx sin campo status se trata como no acreditado", async () => {
    estado.mockResolvedValue({ documents: [] });
    const r = await reconciliar();
    expect(r.data?.outcome).toBe("NO_SOLICITADA");
    expect(artefactos).not.toHaveBeenCalled();
  });
});
