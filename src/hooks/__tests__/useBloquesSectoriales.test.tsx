// src/hooks/__tests__/useBloquesSectoriales.test.tsx
/**
 * R10 contract: useBloquesSectoriales must NOT fetch when sector='GENERICO'
 * and showAll=false. Defense in depth over the visual hiding in the component.
 *
 * Without this gate, generic societies download/cache all sector-specific
 * approved text, violating the "default empty until opt-in" contract.
 */
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBloquesSectoriales } from "../useBloquesSectoriales";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useBloquesSectoriales — R10 gate", () => {
  it("does NOT fetch when sector='GENERICO' and showAll=false", async () => {
    const { result } = renderHook(
      () => useBloquesSectoriales({ sector: "GENERICO", materia: "NOMBRAMIENTO_CONSEJERO", showAll: false }),
      { wrapper },
    );
    // Query should be disabled — never enters loading nor success
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("does NOT fetch when sector is undefined and showAll=false", async () => {
    const { result } = renderHook(
      () => useBloquesSectoriales({ sector: undefined, materia: "NOMBRAMIENTO_CONSEJERO", showAll: false }),
      { wrapper },
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("DOES fetch when sector='GENERICO' but showAll=true (opt-in)", async () => {
    const { result } = renderHook(
      () => useBloquesSectoriales({ sector: "GENERICO", materia: "NOMBRAMIENTO_CONSEJERO", showAll: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data).toBeDefined();
  });

  it("DOES fetch when sector='COTIZADAS' (specific sector activates query)", async () => {
    const { result } = renderHook(
      () => useBloquesSectoriales({ sector: "COTIZADAS", materia: "CONVOCATORIA_JUNTA", showAll: false }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.data).toBeDefined();
    // COTIZADAS_MAR_DISCLAIMER seeded for this sector + materia
    const mar = result.current.data?.find((b) => b.clave_bloque === "COTIZADAS_MAR_DISCLAIMER");
    expect(mar).toBeDefined();
  });
});
