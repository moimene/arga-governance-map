// src/hooks/__tests__/useBloquesSectoriales.test.tsx
/**
 * R10 contract: useBloquesSectoriales must NOT fetch when sector='GENERICO'
 * and showAll=false. Defense in depth over the visual hiding in the component.
 *
 * Without this gate, generic societies download/cache all sector-specific
 * approved text, violating the "default empty until opt-in" contract.
 *
 * Tests mock Supabase so they are deterministic and never depend on Cloud
 * availability — the previous version relied on the hard-coded Supabase
 * client and would time out when the Cloud project was slow or unreachable.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Shared fixtures. The mocked client returns these rows regardless of the
// filter chain; the hook applies the in-memory .filter() for `materia_aplicable`
// itself, so we just need to expose data the hook can filter through.
const ALL_BLOQUES = [
  {
    id: "bloque-mar-1",
    clave_bloque: "COTIZADAS_MAR_DISCLAIMER",
    version: "1.0.0",
    sector: "COTIZADAS",
    materia_aplicable: ["CONVOCATORIA_JUNTA"],
    texto_aprobado: "Texto MAR disclaimer.",
    referencia_legal: "MAR Art. 17",
    descripcion: "Disclaimer cotizadas",
    estado: "ACTIVA",
  },
  {
    id: "bloque-banca-1",
    clave_bloque: "BANCA_REPORTING",
    version: "1.0.0",
    sector: "BANCA",
    materia_aplicable: ["NOMBRAMIENTO_CONSEJERO"],
    texto_aprobado: "Reporting BdE.",
    referencia_legal: "RDL 4/2015",
    descripcion: "Reporting BdE",
    estado: "ACTIVA",
  },
];

// Capture the last `.eq("sector", X)` value so we can return rows matching
// what the hook would actually fetch. The mock chains all .eq() calls into
// a single PostgREST-like builder and resolves with the filtered subset.
const lastEqCalls: Record<string, string> = {};

vi.mock("@/integrations/supabase/client", () => {
  // The chain is: from(table).select(*).eq("estado","ACTIVA")[.eq("sector",X)]
  // Each .eq() returns the same chain so it remains thenable. The terminal
  // resolver computes the filtered dataset based on captured .eq() values.
  function makeChain() {
    const chain: {
      eq: (col: string, val: string) => typeof chain;
      then: <T>(resolve: (v: { data: unknown; error: null }) => T) => Promise<T>;
    } = {
      eq: (col: string, val: string) => {
        lastEqCalls[col] = val;
        return chain;
      },
      then: (resolve) => {
        const sectorFilter = lastEqCalls["sector"];
        const filtered = sectorFilter
          ? ALL_BLOQUES.filter((b) => b.sector === sectorFilter)
          : ALL_BLOQUES;
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      },
    };
    return chain;
  }

  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        // Reset captured filters per query so successive renders are independent.
        delete lastEqCalls["sector"];
        delete lastEqCalls["estado"];
        return makeChain();
      }),
    })),
  };
  return { supabase };
});

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: "00000000-0000-0000-0000-000000000001" }),
}));

// Import AFTER mocks are registered.
import { useBloquesSectoriales } from "../useBloquesSectoriales";

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
