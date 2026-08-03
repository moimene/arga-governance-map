import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realProxyModule from "@/lib/qtsp/qtsp-proxy-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * La reconciliación solo puede consultar el endpoint source-bound. Un `status`
 * genérico por UUID no acredita tenant, fuente, clase de artefacto ni hash.
 */
const cierre = vi.fn();

const __realModules: Array<[string, Record<string, unknown>]> = [
  ["@/lib/qtsp/qtsp-proxy-client", { ...__realProxyModule }],
];
__afterAllRestore(() => {
  for (const [spec, exports] of __realModules) {
    __bunMockRestore.module(spec, () => exports);
  }
});

vi.mock("@/lib/qtsp/qtsp-proxy-client", () => ({
  reconcileVerifiedEADInterposition: (...a: unknown[]) => cierre(...a),
}));

const { useQTSPReconcile } = await import("../useQTSPReconcile");

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const INPUT = {
  signatureRequestId: "11111111-1111-4111-8111-111111111111",
  sourceDomain: "MINUTE" as const,
  sourceId: "22222222-2222-4222-8222-222222222222",
  artifactKind: "MINUTE_FINAL" as const,
  contentHash: "a".repeat(64),
};

async function reconciliar() {
  const { result } = renderHook(() => useQTSPReconcile(), { wrapper });
  result.current.mutate(INPUT);
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current;
}

beforeEach(() => {
  cierre.mockReset();
});

describe("useQTSPReconcile", () => {
  it("consulta directamente el cierre source-bound y proyecta el resultado verificado", async () => {
    cierre.mockResolvedValue({
      status: "VERIFIED",
      providerStatus: "COMPLETED",
      legalArtifactId: "33333333-3333-4333-8333-333333333333",
    });

    const r = await reconciliar();

    expect(cierre).toHaveBeenCalledTimes(1);
    expect(cierre).toHaveBeenCalledWith(INPUT);
    expect(r.data?.outcome).toBe("COMPLETADA");
    expect(r.data?.providerStatus).toBe("COMPLETED");
    expect(r.data?.reconciliation?.legalArtifactId).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("sin proxy source-bound informa indisponibilidad sin elevar estado alguno", async () => {
    cierre.mockResolvedValue(null);

    const r = await reconciliar();

    expect(r.data?.disponible).toBe(false);
    expect(r.data?.providerStatus).toBeNull();
    expect(r.data?.outcome).toBe("NO_SOLICITADA");
    expect(r.data?.reconciliation).toBeNull();
  });

  it("propaga un rechazo source-bound y no lo degrada a estado genérico", async () => {
    cierre.mockRejectedValue(new Error("source binding mismatch"));

    const r = await reconciliar();

    expect(r.isError).toBe(true);
    expect(r.error?.message).toContain("source binding mismatch");
  });
});
